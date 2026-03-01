"""
ESPHome Forge – FastAPI Backend
Läuft als HA Add-on auf Port 7052, zugänglich via Ingress.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import StreamingResponse

from boards import registry, Board, BoardSummary, GpioConflictResult
from projects import project_registry, ForgeProject, ForgeProjectCreate, DeviceListItem, ProjectComponent, DeviceInfo
from components import (
    component_registry,
    ComponentSummary as CompSummary,
    ComponentDetail as CompDetail,
    ComponentCategoryInfo,
    CustomComponent,
    CustomComponentCreate,
)
from esphome_proxy import (
    get_esphome_status,
    esphome_compile,
    esphome_upload,
    esphome_logs_stream,
    esphome_device_ping,
    discover_device_ip,
)

log = logging.getLogger("esphome_forge")
logging.basicConfig(level=logging.INFO,
                    format="%(levelname)s  %(name)s  %(message)s")


# ── Startup / Shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("ESPHome Forge starting up...")
    registry.load()
    project_registry.load()
    await component_registry.load()
    yield
    log.info("ESPHome Forge shutting down.")


app = FastAPI(
    title="ESPHome Forge",
    version="0.1.0",
    description="Visueller ESPHome Konfigurator – Board-Datenbank API",
    lifespan=lifespan,
)

# CORS für Frontend-Dev-Server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Board-Endpunkte ───────────────────────────────────────────────────────────

@app.get(
    "/api/boards",
    response_model=list[BoardSummary],
    summary="Alle bekannten Boards auflisten",
    tags=["boards"],
)
async def list_boards(
    family: Optional[str] = Query(None, description="Filter nach Chip-Familie, z.B. 'ESP32-C3'"),
    has_display: Optional[bool] = Query(None, description="Filter: nur Boards mit eingebautem Display"),
):
    boards = registry.get_all()
    if family:
        boards = [b for b in boards if b.chip_family.value == family]
    if has_display is not None:
        boards = [b for b in boards if b.has_display == has_display]
    return boards


@app.get(
    "/api/boards/{board_id}",
    response_model=Board,
    summary="Vollständige Board-Definition abrufen",
    tags=["boards"],
)
async def get_board(board_id: str):
    board = registry.get(board_id)
    if not board:
        raise HTTPException(404, detail=f"Board '{board_id}' nicht gefunden.")
    return board


@app.post(
    "/api/boards",
    response_model=BoardSummary,
    status_code=201,
    summary="Custom Board anlegen",
    tags=["boards"],
)
async def create_board(board: Board):
    if registry.exists(board.id) and not registry.is_custom(board.id):
        raise HTTPException(409, detail=f"'{board.id}' ist ein Built-in Board und kann nicht überschrieben werden.")
    registry.save_custom(board)
    return BoardSummary.from_board(board)


@app.delete(
    "/api/boards/{board_id}",
    status_code=204,
    summary="Custom Board löschen",
    tags=["boards"],
)
async def delete_board(board_id: str):
    if not registry.delete_custom(board_id):
        raise HTTPException(
            404,
            detail=f"Board '{board_id}' nicht gefunden oder ist ein Built-in Board (nicht löschbar)."
        )


# ── GPIO-Endpunkte ────────────────────────────────────────────────────────────

@app.get(
    "/api/boards/{board_id}/gpios",
    summary="GPIO-Matrix des Boards",
    tags=["gpio"],
)
async def get_gpios(board_id: str):
    board = registry.get(board_id)
    if not board:
        raise HTTPException(404, detail=f"Board '{board_id}' nicht gefunden.")
    return {
        "board_id": board_id,
        "gpios": board.gpios,
        "free": [g.num for g in board.free_gpios()],
        "used": [
            {"gpio": g.num, "comp": g.board_usage.comp, "role": g.board_usage.role}
            for g in board.used_gpios()
        ],
        "adc1_wifi_safe": [g.num for g in board.adc1_gpios()],
        "touch_capable": [g.num for g in board.touch_gpios()],
    }


@app.get(
    "/api/boards/{board_id}/gpios/{gpio_num}/check",
    response_model=GpioConflictResult,
    summary="GPIO auf Konflikte prüfen",
    description=(
        "Prüft ob ein GPIO für eine bestimmte Verwendung verfügbar ist. "
        "Gibt Konflikte, Warnungen und alternative GPIO-Vorschläge zurück."
    ),
    tags=["gpio"],
)
async def check_gpio(
    board_id: str,
    gpio_num: int,
    need_output:    bool = Query(False),
    need_input:     bool = Query(False),
    need_adc:       bool = Query(False),
    need_dac:       bool = Query(False),
    need_touch:     bool = Query(False),
    need_pwm:       bool = Query(False),
    need_spi_role:  Optional[str] = Query(None, description="CLK|MOSI|MISO|CS"),
    need_i2c_role:  Optional[str] = Query(None, description="SDA|SCL"),
    need_uart_role: Optional[str] = Query(None, description="TX|RX"),
    wifi_active:    bool = Query(True, description="WiFi läuft → ADC2 gesperrt"),
):
    return registry.check_gpio(
        board_id, gpio_num,
        need_output=need_output, need_input=need_input,
        need_adc=need_adc, need_dac=need_dac,
        need_touch=need_touch, need_pwm=need_pwm,
        need_spi_role=need_spi_role, need_i2c_role=need_i2c_role,
        need_uart_role=need_uart_role, wifi_active=wifi_active,
    )


# ── Projekt-Endpunkte ─────────────────────────────────────────────────────────

@app.get(
    "/api/projects/devices",
    response_model=list[DeviceListItem],
    summary="Alle Geräte: Forge-Projekte + externe ESPHome-Configs",
    tags=["projects"],
)
async def list_devices():
    return project_registry.get_all_devices()


@app.get(
    "/api/projects",
    response_model=list[ForgeProject],
    summary="Alle Forge-Projekte auflisten",
    tags=["projects"],
)
async def list_projects():
    return project_registry.get_all()


@app.get(
    "/api/projects/{project_id}",
    response_model=ForgeProject,
    summary="Forge-Projekt abrufen",
    tags=["projects"],
)
async def get_project(project_id: str):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")
    return project


@app.post(
    "/api/projects",
    response_model=ForgeProject,
    status_code=201,
    summary="Neues Forge-Projekt erstellen",
    tags=["projects"],
)
async def create_project(body: ForgeProjectCreate):
    # Board validieren
    board = registry.get(body.board_id)
    if not board:
        raise HTTPException(404, detail=f"Board '{body.board_id}' nicht gefunden.")
    project = project_registry.create(
        name=body.name,
        board_id=board.id,
        board_name=board.name,
        chip_family=board.chip.family.value,
        esphome_board=board.esphome_board,
    )
    return project


@app.delete(
    "/api/projects/{project_id}",
    status_code=204,
    summary="Forge-Projekt löschen",
    tags=["projects"],
)
async def delete_project(project_id: str):
    if not project_registry.delete(project_id):
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")


# ── Projekt-Komponenten & YAML ─────────────────────────────────────────────────

@app.put(
    "/api/projects/{project_id}/components",
    response_model=ForgeProject,
    summary="Komponenten eines Projekts aktualisieren und YAML neu generieren",
    tags=["projects"],
)
async def update_project_components(project_id: str, components: list[ProjectComponent]):
    # Enrichment + Custom-Daten für YAML-Builder bereitstellen
    enrichment = component_registry._enrichment
    customs = {
        cc_id: cc.model_dump()
        for cc_id, cc in component_registry._customs.items()
    }
    project = project_registry.update_components(
        project_id, components, enrichment=enrichment, custom_components=customs,
    )
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")
    return project


@app.get(
    "/api/projects/{project_id}/yaml",
    summary="Generiertes ESPHome-YAML abrufen",
    tags=["projects"],
    response_class=PlainTextResponse,
)
async def get_project_yaml(project_id: str):
    yaml = project_registry.get_yaml(project_id)
    if yaml is None:
        raise HTTPException(404, detail=f"Kein YAML für Projekt '{project_id}' vorhanden.")
    return yaml


# ── Component-Endpunkte ────────────────────────────────────────────────────────

@app.get(
    "/api/components",
    response_model=list[CompSummary],
    summary="Alle verfügbaren ESPHome-Komponenten auflisten",
    tags=["components"],
)
async def list_components(
    category: Optional[str] = Query(None, description="Filter nach Kategorie"),
    platform: Optional[str] = Query(None, description="Filter nach Platform-Typ (sensor, light, ...)"),
    bus: Optional[str] = Query(None, description="Filter nach Bus-Typ (i2c, spi, ...)"),
    q: Optional[str] = Query(None, description="Textsuche in Name/Beschreibung"),
):
    items = component_registry.get_all_summaries()
    if category:
        items = [c for c in items if c.category == category]
    if platform:
        items = [c for c in items if c.platform_type == platform]
    if bus:
        items = [c for c in items if c.bus_type == bus]
    if q:
        q_lower = q.lower()
        items = [c for c in items if q_lower in c.name.lower()
                 or (c.description and q_lower in c.description.lower())
                 or q_lower in c.id.lower()]
    return items


@app.get(
    "/api/components/categories",
    response_model=list[ComponentCategoryInfo],
    summary="Alle Komponentenkategorien mit Anzahl",
    tags=["components"],
)
async def list_component_categories():
    return component_registry.get_categories()


@app.get(
    "/api/components/{comp_id}",
    response_model=CompDetail,
    summary="Komponentendetails mit Config-Schema",
    tags=["components"],
)
async def get_component(comp_id: str):
    detail = component_registry.get_detail(comp_id)
    if not detail:
        raise HTTPException(404, detail=f"Komponente '{comp_id}' nicht gefunden.")
    return detail


@app.post(
    "/api/components/custom",
    response_model=CustomComponent,
    status_code=201,
    summary="Benutzerdefinierte Komponente anlegen",
    tags=["components"],
)
async def create_custom_component(body: CustomComponentCreate):
    return component_registry.create_custom(body)


@app.delete(
    "/api/components/custom/{comp_id}",
    status_code=204,
    summary="Benutzerdefinierte Komponente löschen",
    tags=["components"],
)
async def delete_custom_component(comp_id: str):
    if not component_registry.delete_custom(comp_id):
        raise HTTPException(404, detail=f"Custom-Komponente '{comp_id}' nicht gefunden.")


@app.post(
    "/api/components/refresh",
    summary="Schema-Cache neu laden",
    tags=["components"],
)
async def refresh_component_schemas():
    await component_registry.load()
    return {
        "status": "ok",
        "schema_version": component_registry._summaries_cache and len(component_registry.get_all_summaries()),
    }


# ── ESPHome-Integration ───────────────────────────────────────────────────────

@app.get(
    "/api/esphome/status",
    summary="ESPHome-Addon-Status prüfen",
    tags=["esphome"],
)
async def check_esphome_status():
    status = await get_esphome_status()
    return status.to_dict()


@app.post(
    "/api/projects/{project_id}/compile",
    summary="YAML kompilieren via ESPHome-Addon",
    tags=["esphome"],
)
async def compile_project(project_id: str):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")

    # Compile-Status setzen
    _update_device_field(project_id, compile_status="compiling")

    result = await esphome_compile(project_id)

    # Status aktualisieren
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    if result.get("success"):
        _update_device_field(project_id, compile_status="compiled", last_compile=now)
    else:
        _update_device_field(project_id, compile_status="error")

    return result


@app.post(
    "/api/projects/{project_id}/upload",
    summary="Firmware per OTA auf Device flashen",
    tags=["esphome"],
)
async def upload_to_device(
    project_id: str,
    ip: str | None = Query(None, description="Device-IP (optional, sonst Auto-Discover)"),
):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")

    # IP ermitteln
    device_ip = ip or (project.device.device_ip if project.device else None)
    if not device_ip:
        discovered = await discover_device_ip(project_id)
        if discovered:
            device_ip = discovered
            _update_device_field(project_id, device_ip=discovered)

    result = await esphome_upload(project_id, device_ip)

    if result.get("success"):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        _update_device_field(project_id, last_upload=now, last_seen=now)

    return result


@app.get(
    "/api/projects/{project_id}/logs",
    summary="Compile/Upload-Logs streamen (SSE)",
    tags=["esphome"],
)
async def stream_logs(project_id: str):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")

    return StreamingResponse(
        esphome_logs_stream(project_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get(
    "/api/projects/{project_id}/device",
    summary="Device-Infos eines Projekts abrufen",
    tags=["esphome"],
)
async def get_device_info(project_id: str):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")

    device = project.device or DeviceInfo()
    online = False
    if device.device_ip:
        online = await esphome_device_ping(device.device_ip)
        if online:
            _update_device_field(project_id, last_seen=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat())

    return {
        **device.model_dump(),
        "online": online,
    }


@app.put(
    "/api/projects/{project_id}/device",
    summary="Device-Infos aktualisieren (z.B. IP setzen)",
    tags=["esphome"],
)
async def update_device_info(project_id: str, update: dict):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")

    _update_device_field(project_id, **update)
    updated_project = project_registry.get(project_id)
    return updated_project.device.model_dump() if updated_project and updated_project.device else {}


@app.post(
    "/api/projects/{project_id}/discover",
    summary="Device-IP automatisch ermitteln (mDNS/ESPHome-Storage)",
    tags=["esphome"],
)
async def discover_device(project_id: str):
    project = project_registry.get(project_id)
    if not project:
        raise HTTPException(404, detail=f"Projekt '{project_id}' nicht gefunden.")

    ip = await discover_device_ip(project_id)
    if ip:
        _update_device_field(project_id, device_ip=ip)
        online = await esphome_device_ping(ip)
        return {"found": True, "ip": ip, "online": online}
    return {"found": False, "ip": None, "online": False}


def _update_device_field(project_id: str, **fields) -> None:
    """Aktualisiert einzelne Device-Felder eines Projekts."""
    project = project_registry.get(project_id)
    if not project:
        return
    device_data = (project.device or DeviceInfo()).model_dump()
    # Nur bekannte Felder aktualisieren
    allowed = set(DeviceInfo.model_fields.keys())
    for key, val in fields.items():
        if key in allowed:
            device_data[key] = val
    from datetime import datetime, timezone
    updated = project.model_copy(update={
        "device": DeviceInfo(**device_data),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    project_registry._projects[project_id] = updated
    project_registry._save(updated)


# ── Frontend (statische Dateien) ──────────────────────────────────────────────

import os as _os

_frontend_dir = _os.environ.get("FORGE_FRONTEND_DIR", "/app/frontend")
try:
    app.mount("/", StaticFiles(directory=_frontend_dir, html=True), name="frontend")
    log.info(f"Frontend bereitgestellt aus: {_frontend_dir}")
except Exception:
    log.warning(f"Kein Frontend-Build gefunden unter {_frontend_dir}. Nur API verfügbar.")


# ── CLI-Einstiegspunkt ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=7052, reload=True)
