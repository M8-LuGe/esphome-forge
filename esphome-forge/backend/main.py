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
from fastapi.staticfiles import StaticFiles

from boards import registry, Board, BoardSummary, GpioConflictResult

log = logging.getLogger("esphome_forge")
logging.basicConfig(level=logging.INFO,
                    format="%(levelname)s  %(name)s  %(message)s")


# ── Startup / Shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("ESPHome Forge starting up...")
    registry.load()
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


# ── Frontend (statische Dateien) ──────────────────────────────────────────────

try:
    app.mount("/", StaticFiles(directory="/app/frontend", html=True), name="frontend")
except Exception:
    log.warning("Kein Frontend-Build gefunden. Nur API verfügbar.")


# ── CLI-Einstiegspunkt ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=7052, reload=True)
