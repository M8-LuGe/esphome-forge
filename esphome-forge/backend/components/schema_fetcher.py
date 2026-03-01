"""
SchemaFetcher – Lädt ESPHome-Komponenten-Schemas aus dem esphome-schema Repository.

Strategie:
  1. Prüfe lokalen Cache (ZIP + extrahierte JSON-Dateien)
  2. Falls nicht vorhanden oder veraltet → Download von GitHub Releases
  3. ZIP entpacken → JSON-Dateien pro Komponente lesen
  4. Vereinfachte Component-Daten an Registry liefern
"""
from __future__ import annotations

import io
import json
import logging
import os
import time
import zipfile
from pathlib import Path
from typing import Any, Optional

import httpx

log = logging.getLogger(__name__)

# Konfiguration
SCHEMA_CACHE_DIR = Path(os.environ.get(
    "FORGE_SCHEMA_CACHE",
    str(Path(__file__).parent / "cache")
))
SCHEMA_MAX_AGE_HOURS = int(os.environ.get("FORGE_SCHEMA_MAX_AGE", "168"))  # 7 Tage
GITHUB_RELEASES_URL = "https://api.github.com/repos/esphome/esphome-schema/releases"
DOWNLOAD_TIMEOUT = 60  # Sekunden


class SchemaFetcher:
    """Lädt und cached die ESPHome-Schema-Dateien."""

    def __init__(self) -> None:
        self._schemas: dict[str, dict] = {}
        self._version: Optional[str] = None
        self._loaded = False

    @property
    def version(self) -> Optional[str]:
        return self._version

    @property
    def loaded(self) -> bool:
        return self._loaded

    # ── Öffentliche API ───────────────────────────────────────────────────

    async def load(self, force_refresh: bool = False) -> None:
        """Schema laden (aus Cache oder Download)."""
        schema_dir = SCHEMA_CACHE_DIR / "schema"

        if not force_refresh and self._cache_valid(schema_dir):
            log.info("Schema-Cache ist aktuell, lade aus Cache...")
            self._load_from_dir(schema_dir)
            return

        log.info("Lade ESPHome-Schema von GitHub...")
        try:
            await self._download_latest()
            self._load_from_dir(schema_dir)
        except Exception as e:
            # Fallback: falls Cache existiert, nutze ihn trotz Alter
            if schema_dir.exists() and any(schema_dir.glob("*.json")):
                log.warning(f"Download fehlgeschlagen ({e}), nutze veralteten Cache.")
                self._load_from_dir(schema_dir)
            else:
                log.error(f"Kein Schema verfügbar: {e}")
                self._loaded = False

    def get_schema(self, name: str) -> Optional[dict]:
        """Schema-Datei nach Name abrufen (z.B. 'esphome', 'sensor', 'dht')."""
        return self._schemas.get(name)

    def get_all_schemas(self) -> dict[str, dict]:
        """Alle geladenen Schemas."""
        return dict(self._schemas)

    def get_core(self) -> Optional[dict]:
        """Core-Schema mit platforms, components, pins."""
        esphome = self._schemas.get("esphome", {})
        return esphome.get("core")

    def get_component_names(self) -> list[str]:
        """Alle verfügbaren Komponentennamen."""
        return sorted(self._schemas.keys())

    # ── Cache ─────────────────────────────────────────────────────────────

    def _cache_valid(self, schema_dir: Path) -> bool:
        """Prüfe ob Cache existiert und jung genug ist."""
        marker = SCHEMA_CACHE_DIR / ".last_fetch"
        if not marker.exists() or not schema_dir.exists():
            return False
        age_hours = (time.time() - marker.stat().st_mtime) / 3600
        return age_hours < SCHEMA_MAX_AGE_HOURS

    def _touch_marker(self) -> None:
        SCHEMA_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        marker = SCHEMA_CACHE_DIR / ".last_fetch"
        marker.write_text(str(time.time()))

    # ── Download ──────────────────────────────────────────────────────────

    async def _download_latest(self) -> None:
        """Neuestes Release finden und schema.zip herunterladen."""
        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
            # Neuestes nicht-pre-release finden
            resp = await client.get(
                GITHUB_RELEASES_URL,
                params={"per_page": 10},
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            resp.raise_for_status()
            releases = resp.json()

            # Erstes stabiles Release suchen
            download_url: Optional[str] = None
            version: Optional[str] = None
            for release in releases:
                if release.get("prerelease"):
                    continue
                for asset in release.get("assets", []):
                    if asset["name"] == "schema.zip":
                        download_url = asset["browser_download_url"]
                        version = release["tag_name"]
                        break
                if download_url:
                    break

            if not download_url:
                raise RuntimeError("Kein schema.zip in ESPHome-Schema-Releases gefunden.")

            log.info(f"Lade schema.zip v{version} herunter: {download_url}")
            zip_resp = await client.get(download_url)
            zip_resp.raise_for_status()

            # Entpacken
            self._extract_zip(zip_resp.content)
            self._version = version
            self._touch_marker()
            log.info(f"Schema v{version} heruntergeladen und entpackt ({len(zip_resp.content)} Bytes)")

    def _extract_zip(self, zip_bytes: bytes) -> None:
        """ZIP-Archiv ins Cache-Verzeichnis entpacken."""
        schema_dir = SCHEMA_CACHE_DIR / "schema"
        schema_dir.mkdir(parents=True, exist_ok=True)

        # Alte Dateien aufräumen
        for old in schema_dir.glob("*.json"):
            old.unlink()

        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                # Dateien liegen entweder im Root oder in schema/
                name = info.filename
                if "/" in name:
                    name = name.split("/", 1)[-1]
                if not name.endswith(".json"):
                    continue
                # In schema/ schreiben
                target = schema_dir / name
                target.write_bytes(zf.read(info))

    # ── Laden ─────────────────────────────────────────────────────────────

    def _load_from_dir(self, schema_dir: Path) -> None:
        """Alle JSON-Dateien aus dem Cache-Verzeichnis laden."""
        self._schemas.clear()
        loaded = 0

        for path in sorted(schema_dir.glob("*.json")):
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                self._schemas[path.stem] = data
                loaded += 1
            except (json.JSONDecodeError, OSError) as e:
                log.warning(f"Schema-Datei fehlerhaft: {path.name}: {e}")

        # Version aus marker oder Dateiname
        version_file = SCHEMA_CACHE_DIR / ".version"
        if version_file.exists():
            self._version = version_file.read_text().strip()

        self._loaded = loaded > 0
        log.info(f"SchemaFetcher: {loaded} Schema-Dateien geladen (Version: {self._version or 'unbekannt'})")


# Singleton
schema_fetcher = SchemaFetcher()
