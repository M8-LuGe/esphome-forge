"""
ProjectRegistry – verwaltet Forge-Projekte und scannt ESPHome-Konfigurationen.

Speicherort (Priorität):
  1. ENV FORGE_DATA_DIR  (Default: ./projects/data    → Dev-Modus)
  2. /share/esphome-forge/projects/                    → HA Add-on

ESPHome-Config-Scan:
  ENV ESPHOME_CONFIG_DIR (Default: /config/esphome)
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .schema import ForgeProject, DeviceInfo, DeviceListItem, ProjectComponent
from .yaml_builder import build_yaml


def _generate_api_key() -> str:
    """Erzeugt einen 32-Byte-Base64 API-Encryption-Key (ESPHome-kompatibel)."""
    return base64.b64encode(secrets.token_bytes(32)).decode()


def _generate_ota_password() -> str:
    """Erzeugt ein 16-Zeichen OTA-Passwort."""
    return secrets.token_hex(8)

log = logging.getLogger(__name__)

# ── Pfade (über Env konfigurierbar) ──────────────────────────────────────────

_DATA_DIR = Path(
    os.environ.get("FORGE_DATA_DIR", Path(__file__).parent / "data")
)
_ESPHOME_CONFIG_DIR = Path(
    os.environ.get("ESPHOME_CONFIG_DIR", "/config/esphome")
)


def _slugify(text: str) -> str:
    """Konvertiert beliebigen Text in einen gültigen ESPHome device-name."""
    text = text.lower().strip()
    # Deutsche Umlaute
    for src, dst in [("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")]:
        text = text.replace(src, dst)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text or "project"


class ProjectRegistry:
    """Zentrale Verwaltung aller Forge-Projekte."""

    def __init__(self) -> None:
        self._projects: dict[str, ForgeProject] = {}

    # ── Laden ─────────────────────────────────────────────────────────────────

    def load(self) -> None:
        """Alle gespeicherten Forge-Projekte laden."""
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        loaded = 0
        for path in sorted(_DATA_DIR.glob("*.json")):
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                project = ForgeProject.model_validate(data)
                self._projects[project.id] = project
                loaded += 1
            except Exception as e:
                log.error(f"Fehler beim Laden von {path.name}: {e}")
        log.info(f"ProjectRegistry: {loaded} Projekte geladen.")

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def get_all(self) -> list[ForgeProject]:
        return list(self._projects.values())

    def get(self, project_id: str) -> Optional[ForgeProject]:
        return self._projects.get(project_id)

    def exists(self, project_id: str) -> bool:
        return project_id in self._projects

    def create(
        self,
        name: str,
        board_id: str,
        board_name: str,
        chip_family: str,
        esphome_board: str,
    ) -> ForgeProject:
        """Neues Forge-Projekt erstellen, speichern und YAML generieren."""
        slug = _slugify(name)
        base_slug = slug
        counter = 1
        while slug in self._projects:
            slug = f"{base_slug}-{counter}"
            counter += 1

        now = datetime.now(timezone.utc).isoformat()
        device = DeviceInfo(
            api_key=_generate_api_key(),
            ota_password=_generate_ota_password(),
            esphome_name=slug,
            mdns_name=f"{slug}.local",
        )
        project = ForgeProject(
            id=slug,
            name=name,
            board_id=board_id,
            board_name=board_name,
            chip_family=chip_family,
            esphome_board=esphome_board,
            created_by_forge=True,
            created_at=now,
            updated_at=now,
            device=device,
        )

        self._save(project)
        self._projects[project.id] = project
        self._generate_yaml(project)
        return project

    def delete(self, project_id: str) -> bool:
        """Forge-Projekt löschen (Metadaten + optional YAML)."""
        if project_id not in self._projects:
            return False

        # Metadaten löschen
        path = _DATA_DIR / f"{project_id}.json"
        if path.exists():
            path.unlink()

        # YAML löschen (nur wenn Forge es erstellt hat)
        yaml_path = self._yaml_path(project_id)
        if yaml_path.exists():
            yaml_path.unlink()
            log.info(f"YAML gelöscht: {yaml_path}")

        self._projects.pop(project_id, None)
        log.info(f"Projekt gelöscht: {project_id}")
        return True

    # ── Geräteliste (Forge + externe) ─────────────────────────────────────────

    def get_all_devices(self) -> list[DeviceListItem]:
        """Alle Geräte: Forge-Projekte + externe ESPHome-Konfigurationen."""
        devices: list[DeviceListItem] = []

        # 1. Forge-Projekte
        for p in self._projects.values():
            devices.append(DeviceListItem(
                id=p.id,
                name=p.name,
                board_id=p.board_id,
                board_name=p.board_name,
                chip_family=p.chip_family,
                created_by_forge=True,
                created_at=p.created_at,
                yaml_exists=self._yaml_path(p.id).exists(),
                device_ip=p.device.device_ip if p.device else None,
                compile_status=p.device.compile_status if p.device else None,
            ))

        # 2. Externe ESPHome-Configs (nicht von Forge verwaltet)
        seen_ids = set(self._projects.keys())
        if _ESPHOME_CONFIG_DIR.exists():
            for yaml_path in sorted(_ESPHOME_CONFIG_DIR.glob("*.yaml")):
                stem = yaml_path.stem
                if stem in seen_ids or stem.startswith(".") or stem == "secrets":
                    continue
                # Prüfen ob forge_managed-Marker vorhanden
                if self._is_forge_managed_yaml(yaml_path):
                    continue  # Schon als Forge-Projekt geladen
                name = (
                    self._extract_name_from_yaml(yaml_path)
                    or stem.replace("-", " ").replace("_", " ").title()
                )
                devices.append(DeviceListItem(
                    id=stem,
                    name=name,
                    created_by_forge=False,
                    yaml_exists=True,
                ))

        return devices

    # ── Komponenten-Verwaltung ───────────────────────────────────────────────

    def update_components(
        self,
        project_id: str,
        components: list[ProjectComponent],
        enrichment: dict | None = None,
        custom_components: dict | None = None,
    ) -> Optional[ForgeProject]:
        """Komponenten eines Projekts aktualisieren und YAML neu generieren."""
        project = self._projects.get(project_id)
        if not project:
            return None

        now = datetime.now(timezone.utc).isoformat()
        updated = project.model_copy(update={
            "components": components,
            "updated_at": now,
        })
        self._projects[project_id] = updated
        self._save(updated)
        self._regenerate_yaml(updated, enrichment, custom_components)
        return updated

    def get_yaml(self, project_id: str) -> Optional[str]:
        """YAML-Inhalt eines Projekts lesen."""
        yaml_path = self._yaml_path(project_id)
        if not yaml_path.exists():
            return None
        return yaml_path.read_text(encoding="utf-8")

    def _regenerate_yaml(
        self,
        project: ForgeProject,
        enrichment: dict | None = None,
        custom_components: dict | None = None,
    ) -> None:
        """YAML aus Projekt + Komponenten neu generieren."""
        yaml_content = build_yaml(
            project=project,
            components=project.components,
            enrichment=enrichment,
            custom_components=custom_components,
        )
        yaml_path = self._yaml_path(project.id)
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(yaml_content)
        log.info(f"YAML regeneriert: {yaml_path} ({len(project.components)} Komponenten)")

    # ── Interne Helfer ────────────────────────────────────────────────────────

    def _save(self, project: ForgeProject) -> None:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        path = _DATA_DIR / f"{project.id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(project.model_dump(), f, ensure_ascii=False, indent=2)
        log.info(f"Projekt gespeichert: {project.id}")

    def _yaml_path(self, project_id: str) -> Path:
        """Pfad zur ESPHome-YAML-Datei."""
        if _ESPHOME_CONFIG_DIR.exists():
            return _ESPHOME_CONFIG_DIR / f"{project_id}.yaml"
        # Dev-Fallback: neben den Metadaten speichern
        return _DATA_DIR / f"{project_id}.yaml"

    def _generate_yaml(self, project: ForgeProject) -> None:
        """ESPHome-YAML für ein neues Projekt generieren (via Builder)."""
        self._regenerate_yaml(project)

    @staticmethod
    def _extract_name_from_yaml(path: Path) -> Optional[str]:
        """Versucht friendly_name aus einer ESPHome-YAML zu extrahieren."""
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped.startswith("friendly_name:"):
                        name = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                        if name:
                            return name
        except Exception:
            pass
        return None

    @staticmethod
    def _is_forge_managed_yaml(path: Path) -> bool:
        """Prüft ob eine YAML-Datei den forge_managed-Marker enthält."""
        try:
            with open(path, encoding="utf-8") as f:
                for i, line in enumerate(f):
                    if i > 5:
                        break
                    if "forge_managed: true" in line:
                        return True
        except Exception:
            pass
        return False


# Singleton
project_registry = ProjectRegistry()
