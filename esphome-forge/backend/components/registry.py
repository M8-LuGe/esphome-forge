"""
ComponentRegistry – Vereint ESPHome-Schema-Daten mit kuratierten Enrichment-Daten.

Ablauf:
  1. SchemaFetcher lädt/cached JSON-Schemas von esphome-schema (GitHub Releases)
  2. Enrichment-Daten (enrichment.json) liefern Kategorie, Name, Icon, Bus, etc.
  3. Registry fusioniert beides zu ComponentSummary / ComponentDetail Objekten
  4. Custom Components werden lokal persistiert und über external_components ins YAML eingebunden
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .schema import (
    ComponentSummary,
    ComponentDetail,
    ComponentCategoryInfo,
    ConfigField,
    CustomComponent,
    CustomComponentCreate,
)
from .schema_fetcher import schema_fetcher

log = logging.getLogger(__name__)

# ── Pfade ──────────────────────────────────────────────────────────────────────

ENRICHMENT_PATH = Path(__file__).parent / "data" / "enrichment.json"

CUSTOM_DIR = Path(os.environ.get(
    "FORGE_CUSTOM_COMPONENTS_DIR",
    str(Path(__file__).parent / "data" / "custom_components"),
))


class ComponentRegistry:
    """Hauptklasse: verbindet Schema-Daten mit Enrichment."""

    def __init__(self) -> None:
        self._enrichment: dict = {}
        self._categories: dict[str, dict] = {}
        self._customs: dict[str, CustomComponent] = {}
        self._summaries_cache: list[ComponentSummary] | None = None

    # ── Laden ──────────────────────────────────────────────────────────────

    async def load(self) -> None:
        """Alles laden: Enrichment, Schema (async), Custom Components."""
        self._load_enrichment()
        self._load_custom_components()
        await schema_fetcher.load()
        self._summaries_cache = None  # Cache invalidieren
        log.info(
            f"ComponentRegistry geladen: Schema={schema_fetcher.loaded}, "
            f"Enrichment={len(self._enrichment)} Einträge, "
            f"Custom={len(self._customs)} Einträge"
        )

    def _load_enrichment(self) -> None:
        """Kuratierte Metadaten aus enrichment.json laden."""
        if not ENRICHMENT_PATH.exists():
            log.warning(f"Enrichment-Datei nicht gefunden: {ENRICHMENT_PATH}")
            return
        try:
            with open(ENRICHMENT_PATH, encoding="utf-8") as f:
                data = json.load(f)
            self._categories = data.get("categories", {})
            self._enrichment = data.get("components", {})
            log.info(f"Enrichment geladen: {len(self._enrichment)} Komponenten, {len(self._categories)} Kategorien")
        except (json.JSONDecodeError, OSError) as e:
            log.error(f"Enrichment-Datei fehlerhaft: {e}")

    def _load_custom_components(self) -> None:
        """Benutzerdefinierte Komponenten laden."""
        CUSTOM_DIR.mkdir(parents=True, exist_ok=True)
        self._customs.clear()
        for path in sorted(CUSTOM_DIR.glob("*.json")):
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                cc = CustomComponent(**data)
                self._customs[cc.id] = cc
            except Exception as e:
                log.warning(f"Custom-Component fehlerhaft: {path.name}: {e}")
        if self._customs:
            log.info(f"Custom Components geladen: {len(self._customs)}")

    # ── Kategorien ─────────────────────────────────────────────────────────

    def get_categories(self) -> list[ComponentCategoryInfo]:
        """Alle verfügbaren Kategorien mit Anzahl der Komponenten."""
        # Zähle Komponenten pro Kategorie
        counts: dict[str, int] = {}
        for s in self.get_all_summaries():
            cat = s.category
            counts[cat] = counts.get(cat, 0) + 1

        result = []
        for cat_id, info in self._categories.items():
            result.append(ComponentCategoryInfo(
                id=cat_id,
                name=info.get("name", cat_id),
                icon=info.get("icon", "package"),
                count=counts.get(cat_id, 0),
            ))
        return result

    # ── Summaries ──────────────────────────────────────────────────────────

    def get_all_summaries(self) -> list[ComponentSummary]:
        """Alle Komponenten als Summary-Liste (cached)."""
        if self._summaries_cache is not None:
            return self._summaries_cache

        result: list[ComponentSummary] = []
        seen: set[str] = set()

        # 1. Schema-basierte Komponenten
        if schema_fetcher.loaded:
            core = schema_fetcher.get_core()
            if core:
                # Platform-Componenten (sensor, binary_sensor, etc.)
                for platform_name in core.get("platforms", {}):
                    platform_schema = schema_fetcher.get_schema(platform_name)
                    if not platform_schema:
                        continue
                    # Sub-Komponenten dieser Platform
                    ps = platform_schema.get(platform_name, {})
                    for comp_id in ps.get("components", {}):
                        full_id = comp_id
                        if full_id in seen:
                            continue
                        seen.add(full_id)
                        result.append(self._build_summary(
                            comp_id=comp_id,
                            platform_type=platform_name,
                            is_platform=False,
                            deps=ps["components"][comp_id].get("dependencies", []),
                        ))

                # Standalone-Komponenten (i2c, uart, wifi, etc.)
                for comp_id, comp_info in core.get("components", {}).items():
                    if comp_id in seen:
                        continue
                    seen.add(comp_id)
                    result.append(self._build_summary(
                        comp_id=comp_id,
                        platform_type=None,
                        is_platform=comp_id in core.get("platforms", {}),
                        deps=comp_info.get("dependencies", []) if isinstance(comp_info, dict) else [],
                    ))

        # 2. Nur-Enrichment-Komponenten (für Offline / fehlende Schemas)
        for comp_id, info in self._enrichment.items():
            if comp_id in seen:
                continue
            seen.add(comp_id)
            result.append(self._enrichment_to_summary(comp_id, info))

        # 3. Custom Components
        for cc in self._customs.values():
            if cc.id in seen:
                continue
            seen.add(cc.id)
            result.append(ComponentSummary(
                id=cc.id,
                name=cc.name,
                platform_type=cc.platform_type,
                category="custom",
                bus_type=cc.bus_type,
                description=cc.description,
                icon="wrench",
                doc_url=cc.doc_url,
                dependencies=[],
                is_platform=False,
                is_custom=True,
            ))

        result.sort(key=lambda s: (s.category, s.name))
        self._summaries_cache = result
        return result

    def _build_summary(
        self,
        comp_id: str,
        platform_type: str | None,
        is_platform: bool,
        deps: list[str],
    ) -> ComponentSummary:
        """Summary aus Schema + Enrichment zusammenbauen."""
        enrichment = self._enrichment.get(comp_id, {})
        esphome_id = enrichment.get("_esphome_id", comp_id)

        # Enrichment hat Vorrang bei Name, Kategorie, etc.
        name = enrichment.get("name", _humanize(comp_id))
        category = enrichment.get("category", self._guess_category(platform_type))
        bus_type = enrichment.get("bus_type")
        icon = enrichment.get("icon", self._guess_icon(platform_type, category))
        description = enrichment.get("description")
        doc_url = self._build_doc_url(comp_id, platform_type)

        return ComponentSummary(
            id=comp_id,
            name=name,
            platform_type=enrichment.get("platform_type", platform_type),
            category=category,
            bus_type=bus_type,
            description=description,
            icon=icon,
            doc_url=doc_url,
            dependencies=deps,
            is_platform=is_platform,
            is_custom=False,
        )

    def _enrichment_to_summary(self, comp_id: str, info: dict) -> ComponentSummary:
        """Summary nur aus Enrichment-Daten."""
        return ComponentSummary(
            id=comp_id,
            name=info.get("name", _humanize(comp_id)),
            platform_type=info.get("platform_type"),
            category=info.get("category", "misc"),
            bus_type=info.get("bus_type"),
            description=info.get("description"),
            icon=info.get("icon", "package"),
            doc_url=self._build_doc_url(comp_id, info.get("platform_type")),
            dependencies=[],
            is_platform=False,
            is_custom=False,
        )

    # ── Detail ─────────────────────────────────────────────────────────────

    def get_detail(self, comp_id: str) -> Optional[ComponentDetail]:
        """Vollständige Komponentendetails inkl. Config-Felder."""
        # Prüfe Custom zuerst
        if comp_id in self._customs:
            return self._custom_to_detail(self._customs[comp_id])

        enrichment = self._enrichment.get(comp_id, {})
        platform_type = enrichment.get("platform_type")

        # Summary als Basis
        summary = None
        for s in self.get_all_summaries():
            if s.id == comp_id:
                summary = s
                break
        if not summary:
            return None

        # Config-Felder aus Schema extrahieren
        config_fields: list[ConfigField] = []
        sub_sensors: list[str] = enrichment.get("sub_sensors", [])
        auto_load: list[str] = []
        raw_schema: dict | None = None

        if schema_fetcher.loaded:
            raw_schema = self._get_raw_config_schema(comp_id, platform_type)
            if raw_schema:
                config_fields = self._extract_config_fields(raw_schema)

        # Enrichment-basierte Pin-Roles und Extra-Config-Felder injizieren
        config_fields = self._inject_pin_roles(comp_id, enrichment, config_fields)

        return ComponentDetail(
            **summary.model_dump(),
            config_fields=config_fields,
            sub_sensors=sub_sensors,
            auto_load=auto_load,
            device_classes=[],
            chip_families=None,
            raw_schema=raw_schema,
        )

    def _inject_pin_roles(
        self,
        comp_id: str,
        enrichment: dict,
        config_fields: list[ConfigField],
    ) -> list[ConfigField]:
        """Pin-Roles und Extra-Config-Felder aus Enrichment injizieren.

        Wenn pin_roles in enrichment definiert sind, werden alle auto-extrahierten
        Pin-Felder ersetzt. extra_config_fields werden als ConfigFields vorne eingefügt.
        """
        pin_roles = enrichment.get("pin_roles", {})
        extra_config = enrichment.get("extra_config_fields", [])

        if not pin_roles and not extra_config:
            return config_fields

        # Wenn pin_roles definiert: Auto-extrahierte Pin-Felder ersetzen
        if pin_roles:
            non_pin = [f for f in config_fields if f.type != "pin"]
        else:
            non_pin = list(config_fields)

        # Pin-Felder aus pin_roles erzeugen
        pin_fields = [
            ConfigField(
                key=role_name,
                type="pin",
                required=role_info.get("required", True),
                description=role_info.get("label", role_name),
                pin_modes=role_info.get("modes", []),
            )
            for role_name, role_info in pin_roles.items()
        ]

        # Extra-Config-Felder erzeugen (z.B. model, num_leds)
        extra_fields = [
            ConfigField(
                key=ec["key"],
                type=ec.get("type", "string"),
                required=ec.get("required", False),
                default=ec.get("default"),
                description=ec.get("label", ec["key"]),
                enum_values=ec.get("enum_values"),
            )
            for ec in extra_config
        ]

        return pin_fields + extra_fields + non_pin

    def _get_raw_config_schema(self, comp_id: str, platform_type: str | None) -> dict | None:
        """Das rohe CONFIG_SCHEMA aus den Schema-Dateien holen."""
        if platform_type:
            # Platform-Component: z.B. dht in sensor.json → sensor.components.dht
            comp_schema = schema_fetcher.get_schema(comp_id)
            if comp_schema:
                # dht.json hat Key "dht.sensor" oder "dht" je nach Struktur
                for key, val in comp_schema.items():
                    schemas = val.get("schemas", {})
                    cs = schemas.get("CONFIG_SCHEMA")
                    if cs:
                        return cs
        else:
            # Standalone-Component: z.B. i2c.json
            comp_schema = schema_fetcher.get_schema(comp_id)
            if comp_schema:
                for key, val in comp_schema.items():
                    schemas = val.get("schemas", {})
                    cs = schemas.get("CONFIG_SCHEMA")
                    if cs:
                        return cs
        return None

    def _extract_config_fields(self, schema: dict) -> list[ConfigField]:
        """Vereinfachte Config-Felder aus dem JSON-Schema extrahieren."""
        fields: list[ConfigField] = []
        inner = schema
        if "schema" in inner:
            inner = inner["schema"]
        config_vars = inner.get("config_vars", {})

        for key, info in config_vars.items():
            if key in ("id", "trigger_id", "mqtt_id"):
                continue  # Interne IDs überspringen

            f_type = info.get("type", "string")
            required = info.get("key") == "Required"
            default = info.get("default")
            enum_values = None

            pin_modes: list[str] | None = None
            internal = info.get("internal", False)

            if f_type == "enum" and "values" in info:
                enum_values = list(info["values"].keys())
            elif f_type == "pin":
                f_type = "pin"
                pin_modes = info.get("modes", [])
            elif f_type == "boolean":
                f_type = "boolean"
            elif f_type == "integer":
                f_type = "integer"
            elif f_type in ("schema", "trigger", "typed"):
                f_type = "schema"
            elif f_type == "use_id":
                f_type = "use_id"

            fields.append(ConfigField(
                key=key,
                required=required,
                type=f_type,
                default=str(default) if default is not None else None,
                description=info.get("docs"),
                enum_values=enum_values,
                pin_modes=pin_modes,
                internal=internal,
            ))

        return fields

    def _custom_to_detail(self, cc: CustomComponent) -> ComponentDetail:
        """Custom-Component zu Detail konvertieren."""
        return ComponentDetail(
            id=cc.id,
            name=cc.name,
            platform_type=cc.platform_type,
            category="custom",
            bus_type=cc.bus_type,
            description=cc.description,
            icon="wrench",
            doc_url=cc.doc_url,
            dependencies=[],
            is_platform=False,
            is_custom=True,
            config_fields=[],
            sub_sensors=[],
            auto_load=[],
            device_classes=[],
            chip_families=None,
            raw_schema=None,
        )

    # ── Custom Components CRUD ─────────────────────────────────────────────

    def create_custom(self, data: CustomComponentCreate) -> CustomComponent:
        """Neue benutzerdefinierte Komponente anlegen."""
        cc = CustomComponent(
            id=data.id,
            name=data.name,
            platform_type=data.platform_type,
            category="custom",
            bus_type=data.bus_type,
            description=data.description,
            doc_url=data.doc_url,
            yaml_snippet=data.yaml_snippet,
            external_source=data.external_source,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._customs[cc.id] = cc
        self._persist_custom(cc)
        self._summaries_cache = None
        return cc

    def delete_custom(self, comp_id: str) -> bool:
        """Custom-Component löschen."""
        if comp_id not in self._customs:
            return False
        del self._customs[comp_id]
        path = CUSTOM_DIR / f"{comp_id}.json"
        if path.exists():
            path.unlink()
        self._summaries_cache = None
        return True

    def get_custom(self, comp_id: str) -> Optional[CustomComponent]:
        """Custom-Component abrufen."""
        return self._customs.get(comp_id)

    def _persist_custom(self, cc: CustomComponent) -> None:
        """Custom-Component als JSON auf Disk speichern."""
        CUSTOM_DIR.mkdir(parents=True, exist_ok=True)
        path = CUSTOM_DIR / f"{cc.id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cc.model_dump(), f, indent=2, ensure_ascii=False)

    # ── Hilfsfunktionen ────────────────────────────────────────────────────

    @staticmethod
    def _build_doc_url(comp_id: str, platform_type: str | None) -> str:
        """ESPHome Doku-URL zusammenbauen."""
        if platform_type:
            return f"https://esphome.io/components/{platform_type}/{comp_id}/"
        return f"https://esphome.io/components/{comp_id}/"

    @staticmethod
    def _guess_category(platform_type: str | None) -> str:
        """Fallback-Kategorie aus dem Platform-Typ ableiten."""
        mapping = {
            "sensor": "sensor-misc",
            "binary_sensor": "binary-sensor",
            "text_sensor": "sensor-misc",
            "display": "display",
            "light": "light",
            "switch": "switch",
            "climate": "climate",
            "cover": "cover",
            "fan": "fan",
            "output": "output",
            "button": "button",
            "number": "number-select",
            "select": "number-select",
            "speaker": "media-audio",
            "microphone": "media-audio",
            "media_player": "media-audio",
            "touchscreen": "display",
            "time": "time",
        }
        return mapping.get(platform_type or "", "misc")

    @staticmethod
    def _guess_icon(platform_type: str | None, category: str) -> str:
        """Fallback-Icon."""
        icon_map = {
            "sensor": "gauge",
            "binary_sensor": "toggle-left",
            "light": "lightbulb",
            "switch": "power",
            "display": "monitor",
            "climate": "thermometer",
            "fan": "fan",
            "output": "sliders-horizontal",
            "speaker": "volume-2",
            "microphone": "mic",
            "cover": "blinds",
        }
        return icon_map.get(platform_type or "", "package")


def _humanize(comp_id: str) -> str:
    """Maschinenlesbaren ID in lesbaren Namen umwandeln."""
    return comp_id.replace("_", " ").replace("-", " ").title()


# Singleton
component_registry = ComponentRegistry()
