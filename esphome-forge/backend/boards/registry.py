"""
BoardRegistry – lädt, validiert und verwaltet alle Board-Definitionen.

Quellen (in dieser Priorität):
  1. /app/backend/boards/data/           – Built-in Boards (mit Add-on ausgeliefert)
  2. /share/esphome-forge/custom_boards/ – Benutzerdefinierte Boards (persistent)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import jsonschema

from .schema import Board, BoardSummary, Gpio, GpioConflictResult

log = logging.getLogger(__name__)

# Pfade
_BUILTIN_DIR = Path(__file__).parent / "data"
_CUSTOM_DIR  = Path("/share/esphome-forge/custom_boards")
_SCHEMA_FILE = _BUILTIN_DIR / "board.schema.json"


class BoardRegistry:
    """Zentrale Verwaltung aller bekannten Boards."""

    def __init__(self):
        self._boards:  dict[str, Board] = {}
        self._schema:  dict             = {}
        self._is_custom: set[str]       = set()  # IDs der benutzerdefinierten Boards

    # ── Laden ─────────────────────────────────────────────────────────────────

    def load(self) -> None:
        """Alle Built-in und Custom Boards laden und validieren."""
        # JSON-Schema laden
        with open(_SCHEMA_FILE, encoding="utf-8") as f:
            self._schema = json.load(f)

        loaded = 0
        errors = 0

        # Built-in Boards
        for path in sorted(_BUILTIN_DIR.glob("*.json")):
            if path.name == "board.schema.json":
                continue
            if self._load_file(path, custom=False):
                loaded += 1
            else:
                errors += 1

        # Custom Boards (überschreiben Built-in bei gleicher ID)
        if _CUSTOM_DIR.exists():
            for path in sorted(_CUSTOM_DIR.glob("*.json")):
                if self._load_file(path, custom=True):
                    loaded += 1
                else:
                    errors += 1

        log.info(f"BoardRegistry: {loaded} Boards geladen, {errors} Fehler.")

    def _load_file(self, path: Path, custom: bool) -> bool:
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)

            # JSON-Schema-Validierung
            jsonschema.validate(data, self._schema)

            # Pydantic-Validierung
            board = Board.model_validate(data)
            self._boards[board.id] = board
            if custom:
                self._is_custom.add(board.id)
            log.debug(f"Board geladen: {board.id} ({path.name})")
            return True

        except jsonschema.ValidationError as e:
            log.error(f"Schema-Fehler in {path.name}: {e.message} @ {list(e.absolute_path)}")
        except Exception as e:
            log.error(f"Fehler beim Laden von {path.name}: {e}")
        return False

    # ── Abfragen ──────────────────────────────────────────────────────────────

    def get_all(self) -> list[BoardSummary]:
        return [BoardSummary.from_board(b) for b in self._boards.values()]

    def get(self, board_id: str) -> Optional[Board]:
        return self._boards.get(board_id)

    def exists(self, board_id: str) -> bool:
        return board_id in self._boards

    def is_custom(self, board_id: str) -> bool:
        return board_id in self._is_custom

    # ── GPIO-Konflikterkennung ────────────────────────────────────────────────

    def check_gpio(
        self,
        board_id: str,
        gpio_num: int,
        *,
        need_output: bool = False,
        need_input:  bool = False,
        need_adc:    bool = False,
        need_dac:    bool = False,
        need_touch:  bool = False,
        need_pwm:    bool = False,
        need_spi_role: Optional[str] = None,   # "CLK"|"MOSI"|"MISO"|"CS"
        need_i2c_role: Optional[str] = None,   # "SDA"|"SCL"
        need_uart_role: Optional[str] = None,  # "TX"|"RX"
        wifi_active: bool = True,
    ) -> GpioConflictResult:
        board = self._boards.get(board_id)
        if board is None:
            return GpioConflictResult(gpio=gpio_num, available=False,
                                      conflicts=[f"Board '{board_id}' nicht gefunden"])

        gpio = board.gpio(gpio_num)
        if gpio is None:
            return GpioConflictResult(gpio=gpio_num, available=False,
                                      conflicts=[f"GPIO{gpio_num} existiert nicht auf diesem Board"])

        conflicts: list[str] = []
        warnings:  list[str] = []

        # Flash-Pin
        if gpio.flash:
            conflicts.append(f"GPIO{gpio_num} ist mit dem SPI-Flash verbunden – nicht verwenden!")

        # Bereits durch Built-in belegt
        if gpio.board_usage:
            conflicts.append(
                f"GPIO{gpio_num} wird bereits durch '{gpio.board_usage.comp}' "
                f"(Rolle: {gpio.board_usage.role}) genutzt."
            )

        # Richtungs-Anforderungen
        if need_output and not gpio.output:
            conflicts.append(f"GPIO{gpio_num} ist Input-only (kein Ausgang möglich).")
        if need_input and not gpio.input:
            conflicts.append(f"GPIO{gpio_num} unterstützt keinen Eingang.")

        # ADC
        if need_adc:
            if gpio.adc is None:
                conflicts.append(f"GPIO{gpio_num} hat kein ADC.")
            elif wifi_active and not gpio.adc.wifi_ok:
                conflicts.append(
                    f"GPIO{gpio_num} nutzt ADC2 – blockiert wenn WiFi aktiv! "
                    f"Nur ADC1 (GPIO32–39 beim ESP32) ist WiFi-kompatibel."
                )

        # DAC
        if need_dac and gpio.dac is None:
            conflicts.append(f"GPIO{gpio_num} hat keinen DAC-Ausgang. "
                             f"Nur GPIO25 (DAC1) und GPIO26 (DAC2) beim ESP32.")

        # Touch
        if need_touch and gpio.touch is None:
            conflicts.append(f"GPIO{gpio_num} unterstützt kein kapazitives Touch.")

        # PWM
        if need_pwm and not gpio.pwm:
            conflicts.append(f"GPIO{gpio_num} unterstützt kein PWM.")

        # SPI MOSI/CLK → Output nötig
        if need_spi_role in ("CLK", "MOSI", "CS") and not gpio.output:
            conflicts.append(f"SPI-Rolle '{need_spi_role}' erfordert Ausgang – GPIO{gpio_num} ist Input-only.")

        # I2C SDA/SCL → Open-Drain nötig
        if need_i2c_role in ("SDA", "SCL"):
            if not gpio.output:
                conflicts.append(f"I2C-Rolle '{need_i2c_role}' erfordert Ausgang – GPIO{gpio_num} ist Input-only.")
            elif not gpio.od:
                warnings.append(f"GPIO{gpio_num} unterstützt kein Open-Drain – I2C könnte instabil sein.")

        # Strapping-Warnung
        if gpio.strapping:
            warnings.append(f"GPIO{gpio_num} ist ein Strapping-Pin: {gpio.strapping}")

        available = len(conflicts) == 0
        suggestions = self._suggest_alternatives(board, gpio_num, need_output=need_output,
                                                  need_adc=need_adc, wifi_active=wifi_active) if not available else []

        return GpioConflictResult(gpio=gpio_num, available=available,
                                  conflicts=conflicts, warnings=warnings,
                                  suggestions=suggestions)

    def _suggest_alternatives(
        self, board: Board, exclude: int,
        need_output: bool, need_adc: bool, wifi_active: bool
    ) -> list[int]:
        """Bis zu 3 freie Alternative-GPIOs vorschlagen."""
        candidates = [
            g.num for g in board.free_gpios()
            if g.num != exclude
            and not g.flash
            and (not need_output or g.output)
            and (not need_adc or (g.adc is not None and (not wifi_active or g.adc.wifi_ok)))
        ]
        return candidates[:3]

    # ── Custom Board speichern ────────────────────────────────────────────────

    def save_custom(self, board: Board) -> None:
        """Custom Board persistent speichern und registrieren."""
        _CUSTOM_DIR.mkdir(parents=True, exist_ok=True)
        path = _CUSTOM_DIR / f"{board.id}.json"

        # Vor dem Speichern gegen Schema validieren
        data = board.model_dump(exclude_none=True)
        jsonschema.validate(data, self._schema)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        self._boards[board.id] = board
        self._is_custom.add(board.id)
        log.info(f"Custom Board gespeichert: {board.id}")

    def delete_custom(self, board_id: str) -> bool:
        """Custom Board löschen. Gibt False zurück wenn nicht gefunden oder Built-in."""
        if board_id not in self._is_custom:
            return False
        path = _CUSTOM_DIR / f"{board_id}.json"
        if path.exists():
            path.unlink()
        self._boards.pop(board_id, None)
        self._is_custom.discard(board_id)
        log.info(f"Custom Board gelöscht: {board_id}")
        return True


# Singleton
registry = BoardRegistry()
