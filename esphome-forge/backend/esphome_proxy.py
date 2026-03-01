"""
ESPHome Proxy – Kommuniziert mit dem ESPHome-Addon über die HA Supervisor-API.

Funktionen:
  1. ESPHome-Addon-Status prüfen (installiert, läuft?)
  2. Compile triggern (YAML → Firmware)
  3. OTA-Upload starten (Firmware → Device)
  4. Compile-Logs streamen

Supervisor API (intern im HA-Addon-Netzwerk):
  Base: http://supervisor/
  Auth: Bearer ${SUPERVISOR_TOKEN}   (automatisch gesetzt von HA OS)
  ESPHome Addon-Slug: 5c53de3b_esphome  (offizielles Addon)
                      esphome            (ESPHome-eigene Builds)
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

import httpx

log = logging.getLogger(__name__)

# ── Konfiguration ──────────────────────────────────────────────────────────────

SUPERVISOR_URL = os.environ.get("SUPERVISOR_URL", "http://supervisor")
SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")

# Das ESPHome Addon hat verschiedene Slugs je nach Installationsquelle
ESPHOME_ADDON_SLUGS = [
    "5c53de3b_esphome",   # Offizieller Add-on Store
    "esphome",             # ESPHome.io eigener Store
    "a0d7b954_esphome",   # Alternative / Community
]

_resolved_slug: str | None = None


def _headers() -> dict[str, str]:
    """Supervisor-API-Auth-Header."""
    return {"Authorization": f"Bearer {SUPERVISOR_TOKEN}"}


def _is_supervisor_available() -> bool:
    """Prüft ob wir in einer HA-Addon-Umgebung laufen."""
    return bool(SUPERVISOR_TOKEN)


# ── Addon-Discovery ──────────────────────────────────────────────────────────

async def _resolve_esphome_slug() -> str | None:
    """Findet den richtigen Slug des installierten ESPHome-Addons."""
    global _resolved_slug
    if _resolved_slug:
        return _resolved_slug

    if not _is_supervisor_available():
        return None

    async with httpx.AsyncClient(timeout=10) as client:
        for slug in ESPHOME_ADDON_SLUGS:
            try:
                resp = await client.get(
                    f"{SUPERVISOR_URL}/addons/{slug}/info",
                    headers=_headers(),
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    if data.get("state") in ("started", "running"):
                        _resolved_slug = slug
                        log.info(f"ESPHome Addon gefunden: {slug} (state={data.get('state')})")
                        return slug
                    else:
                        log.info(f"ESPHome Addon {slug} gefunden aber nicht gestartet: {data.get('state')}")
            except Exception as e:
                log.debug(f"Addon {slug} nicht erreichbar: {e}")
                continue

    log.warning("Kein laufendes ESPHome-Addon gefunden.")
    return None


# ── Status-Abfragen ─────────────────────────────────────────────────────────

class EsphomeStatus:
    """Status des ESPHome-Addons."""
    def __init__(
        self,
        available: bool = False,
        running: bool = False,
        version: str | None = None,
        slug: str | None = None,
        supervisor: bool = False,
    ):
        self.available = available
        self.running = running
        self.version = version
        self.slug = slug
        self.supervisor = supervisor

    def to_dict(self) -> dict:
        return {
            "supervisor_available": self.supervisor,
            "esphome_available": self.available,
            "esphome_running": self.running,
            "esphome_version": self.version,
            "addon_slug": self.slug,
        }


async def get_esphome_status() -> EsphomeStatus:
    """Prüft ob das ESPHome-Addon verfügbar und lauffähig ist."""
    if not _is_supervisor_available():
        return EsphomeStatus(supervisor=False)

    slug = await _resolve_esphome_slug()
    if not slug:
        return EsphomeStatus(supervisor=True)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{SUPERVISOR_URL}/addons/{slug}/info",
                headers=_headers(),
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return EsphomeStatus(
                    supervisor=True,
                    available=True,
                    running=data.get("state") in ("started", "running"),
                    version=data.get("version"),
                    slug=slug,
                )
    except Exception as e:
        log.error(f"ESPHome Status-Abfrage fehlgeschlagen: {e}")

    return EsphomeStatus(supervisor=True, slug=slug)


# ── ESPHome Dashboard API ────────────────────────────────────────────────────
# Das ESPHome-Addon hat seine eigene REST-API auf Port 6052.
# Über den Supervisor Ingress-Proxy erreichbar.

def _esphome_api_url(slug: str) -> str:
    """URL zum ESPHome-Dashboard-API via Supervisor Proxy."""
    return f"{SUPERVISOR_URL}/addons/{slug}/api"


async def esphome_compile(project_id: str) -> dict:
    """Triggert einen Compile-Vorgang im ESPHome-Addon.

    ESPHome-Dashboard API: POST /compile mit dem YAML-Dateinamen.
    Der YAML muss unter /config/esphome/{project_id}.yaml liegen.
    """
    slug = await _resolve_esphome_slug()
    if not slug:
        return {"success": False, "error": "ESPHome-Addon nicht verfügbar"}

    api_url = _esphome_api_url(slug)
    yaml_filename = f"{project_id}.yaml"

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            # ESPHome Dashboard API: Compile
            resp = await client.post(
                f"{api_url}/compile",
                headers=_headers(),
                json={"configuration": yaml_filename},
            )

            if resp.status_code == 200:
                return {
                    "success": True,
                    "message": f"Compile gestartet für {yaml_filename}",
                }
            else:
                error_text = resp.text[:500]
                log.error(f"ESPHome Compile fehlgeschlagen: {resp.status_code} – {error_text}")
                return {
                    "success": False,
                    "error": f"Compile fehlgeschlagen (HTTP {resp.status_code})",
                    "detail": error_text,
                }

    except httpx.TimeoutException:
        return {"success": False, "error": "Compile-Timeout (>300s)"}
    except Exception as e:
        log.error(f"ESPHome Compile Fehler: {e}")
        return {"success": False, "error": str(e)}


async def esphome_upload(project_id: str, device_ip: str | None = None) -> dict:
    """Triggert einen OTA-Upload im ESPHome-Addon.

    ESPHome-Dashboard API: POST /upload mit Konfiguration + optionaler IP.
    """
    slug = await _resolve_esphome_slug()
    if not slug:
        return {"success": False, "error": "ESPHome-Addon nicht verfügbar"}

    api_url = _esphome_api_url(slug)
    yaml_filename = f"{project_id}.yaml"

    payload: dict = {"configuration": yaml_filename}
    if device_ip:
        payload["port"] = device_ip  # ESPHome nutzt "port" für OTA-Ziel

    try:
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{api_url}/upload",
                headers=_headers(),
                json=payload,
            )

            if resp.status_code == 200:
                return {
                    "success": True,
                    "message": f"Upload gestartet für {yaml_filename}" +
                               (f" → {device_ip}" if device_ip else " (mDNS)"),
                }
            else:
                error_text = resp.text[:500]
                log.error(f"ESPHome Upload fehlgeschlagen: {resp.status_code} – {error_text}")
                return {
                    "success": False,
                    "error": f"Upload fehlgeschlagen (HTTP {resp.status_code})",
                    "detail": error_text,
                }

    except httpx.TimeoutException:
        return {"success": False, "error": "Upload-Timeout (>600s)"}
    except Exception as e:
        log.error(f"ESPHome Upload Fehler: {e}")
        return {"success": False, "error": str(e)}


async def esphome_logs_stream(project_id: str) -> AsyncIterator[str]:
    """Streamt Compile/Upload-Logs als Server-Sent Events.

    ESPHome-Dashboard API: GET /logs mit WebSocket oder SSE.
    """
    slug = await _resolve_esphome_slug()
    if not slug:
        yield f"data: {{'error': 'ESPHome-Addon nicht verfügbar'}}\n\n"
        return

    api_url = _esphome_api_url(slug)
    yaml_filename = f"{project_id}.yaml"

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "GET",
                f"{api_url}/logs",
                headers=_headers(),
                params={"configuration": yaml_filename},
            ) as resp:
                async for line in resp.aiter_lines():
                    yield f"data: {line}\n\n"
    except Exception as e:
        yield f"data: {{'error': '{str(e)}'}}\n\n"


async def esphome_device_ping(device_ip: str) -> bool:
    """Prüft ob ein ESPHome-Device erreichbar ist (Native API Port 6053)."""
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(device_ip, 6053),
            timeout=3.0,
        )
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False


async def discover_device_ip(project_id: str) -> str | None:
    """Versucht die IP eines Devices über mDNS-Hostname zu finden.

    Fallback: /config/esphome/.esphome/{project_id}.yaml.json (ESPHome Storage)
    """
    # 1. Versuch: ESPHome Storage-Datei lesen
    import json
    from pathlib import Path

    esphome_storage = Path(
        os.environ.get("ESPHOME_CONFIG_DIR", "/config/esphome")
    ) / ".esphome" / f"{project_id}.yaml.json"

    if esphome_storage.exists():
        try:
            data = json.loads(esphome_storage.read_text(encoding="utf-8"))
            ip = data.get("address")
            if ip:
                log.info(f"Device IP aus ESPHome-Storage: {project_id} → {ip}")
                return ip
        except Exception as e:
            log.debug(f"ESPHome-Storage lesen fehlgeschlagen: {e}")

    # 2. Versuch: mDNS-Name auflösen
    try:
        import socket
        ip = socket.gethostbyname(f"{project_id}.local")
        if ip:
            return ip
    except Exception:
        pass

    return None
