"""
Pydantic v2 Modelle für die ESPHome Forge Board-Datenbank.
Spiegeln board.schema.json 1:1 wider – für API-Serialisierung und Validierung.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ── Enums ──────────────────────────────────────────────────────────────────────

class ChipFamily(str, Enum):
    ESP32    = "ESP32"
    ESP32S2  = "ESP32-S2"
    ESP32S3  = "ESP32-S3"
    ESP32C3  = "ESP32-C3"
    ESP32C6  = "ESP32-C6"
    ESP32H2  = "ESP32-H2"
    ESP8266  = "ESP8266"

class CpuArch(str, Enum):
    XTENSA_LX6 = "xtensa-lx6"
    XTENSA_LX7 = "xtensa-lx7"
    RISCV      = "riscv"

class BoardCategory(str, Enum):
    DEVKIT          = "devkit"
    MODULE          = "module"
    COMPLETE_DEVICE = "complete-device"
    CUSTOM          = "custom"

class SpiHwBus(str, Enum):
    VSPI = "VSPI"
    HSPI = "HSPI"
    SPI0 = "SPI0"
    SPI1 = "SPI1"
    FSPI = "FSPI"

class ComponentType(str, Enum):
    DISPLAY      = "display"
    TOUCHSCREEN  = "touchscreen"
    LED          = "led"
    RGB_LED      = "rgb_led"
    SENSOR       = "sensor"
    MEDIA_PLAYER = "media_player"
    SD_CARD      = "sd_card"
    CAMERA       = "camera"
    BUTTON       = "button"
    UART_BRIDGE  = "uart_bridge"
    OTHER        = "other"


# ── Chip ───────────────────────────────────────────────────────────────────────

class Chip(BaseModel):
    family:       ChipFamily
    model:        Optional[str]    = None
    variant:      str
    revision_min: Optional[int]    = None
    cpu_cores:    int              = 1
    cpu_arch:     Optional[CpuArch] = None
    cpu_mhz:      int
    ram_kb:       int
    flash_mb:     int
    psram_mb:     Optional[int]    = None
    psram_mode:   Optional[str]    = None
    wifi:         bool             = True
    bluetooth:    Optional[str]    = None
    ethernet:     bool             = False
    usb_native:   bool             = False


# ── GPIO ───────────────────────────────────────────────────────────────────────

class GpioAdc(BaseModel):
    unit:    int
    ch:      int
    wifi_ok: bool = Field(description="True=ADC1 (WiFi-kompatibel); False=ADC2 (blockiert wenn WiFi aktiv!)")

class GpioDac(BaseModel):
    ch:   int
    note: Optional[str] = None

class GpioTouch(BaseModel):
    ch: int

class GpioSpiHw(BaseModel):
    bus:  SpiHwBus
    role: str  # "CLK" | "MOSI" | "MISO" | "CS"

class GpioUartDefault(BaseModel):
    unit: int
    role: str  # "TX" | "RX"

class GpioBoardUsage(BaseModel):
    comp: str   # ID der builtin_component
    role: str   # Rolle des Pins
    note: Optional[str] = None

class Gpio(BaseModel):
    num:          int
    labels:       list[str]
    input:        bool
    output:       bool
    od:           bool                    = True    # open-drain
    pu:           bool                    = True    # pull-up
    pd:           bool                    = True    # pull-down
    rtc:          bool                    = False
    pwm:          bool                    = True
    adc:          Optional[GpioAdc]       = None
    dac:          Optional[GpioDac]       = None
    touch:        Optional[GpioTouch]     = None
    spi_hw:       Optional[GpioSpiHw]     = None
    i2c_default:  Optional[str]           = None    # "SDA" | "SCL"
    uart_default: Optional[GpioUartDefault] = None
    strapping:    Optional[str]           = None
    flash:        bool                    = False
    notes:        Optional[str]           = None
    board_usage:  Optional[GpioBoardUsage] = None

    @field_validator("num")
    @classmethod
    def gpio_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("GPIO-Nummer muss >= 0 sein")
        return v


# ── Built-in Components ────────────────────────────────────────────────────────

class ComponentPin(BaseModel):
    gpio: int
    role: Optional[str] = None
    note: Optional[str] = None

class BuiltinComponent(BaseModel):
    id:                str
    type:              ComponentType
    name:              str
    esphome_platform:  Optional[str]              = None
    esphome_model:     Optional[str]              = None
    active_level:      Optional[str]              = None   # "high" | "low"
    pins:              dict[str, ComponentPin]    = {}
    config:            dict                       = {}
    optional:          bool                       = False
    notes:             Optional[str]              = None


# ── Power ──────────────────────────────────────────────────────────────────────

class Power(BaseModel):
    voltage_logic:     float = 3.3
    voltage_input_min: Optional[float] = None
    voltage_input_max: Optional[float] = None


# ── Board (Haupt-Modell) ───────────────────────────────────────────────────────

class Board(BaseModel):
    id:                  str
    name:                str
    aliases:             list[str]          = []
    manufacturer:        Optional[str]      = None
    category:            BoardCategory      = BoardCategory.DEVKIT
    esphome_board:       str
    esphome_framework:   list[str]          = []
    image_url:           Optional[str]      = None
    datasheet_url:       Optional[str]      = None
    purchase_urls:       list[str]          = []
    chip:                Chip
    power:               Optional[Power]    = None
    gpios:               list[Gpio]
    builtin_components:  list[BuiltinComponent] = []
    notes:               Optional[str]      = None
    community_url:       Optional[str]      = None

    # Komfort-Properties ───────────────────────────────────────────────────────

    def gpio(self, num: int) -> Optional[Gpio]:
        """GPIO-Objekt per Nummer suchen."""
        return next((g for g in self.gpios if g.num == num), None)

    def free_gpios(self) -> list[Gpio]:
        """Alle GPIOs ohne board_usage und ohne flash=True."""
        return [g for g in self.gpios if g.board_usage is None and not g.flash]

    def used_gpios(self) -> list[Gpio]:
        """Alle durch Built-in-Komponenten belegten GPIOs."""
        return [g for g in self.gpios if g.board_usage is not None]

    def adc1_gpios(self) -> list[Gpio]:
        """ADC1-fähige GPIOs (WiFi-kompatibel)."""
        return [g for g in self.gpios if g.adc and g.adc.wifi_ok]

    def touch_gpios(self) -> list[Gpio]:
        return [g for g in self.gpios if g.touch is not None]

    def can_be_spi_clk(self, num: int) -> bool:
        g = self.gpio(num)
        return g is not None and g.output and not g.flash

    def can_be_adc(self, num: int) -> bool:
        g = self.gpio(num)
        return g is not None and g.adc is not None


# ── Abgeleitete Typen für API-Responses ───────────────────────────────────────

class BoardSummary(BaseModel):
    """Kurzzusammenfassung für Board-Listen (ohne vollständige GPIO-Matrix)."""
    id:              str
    name:            str
    aliases:         list[str]
    manufacturer:    Optional[str]
    category:        BoardCategory
    esphome_board:   str
    chip_family:     ChipFamily
    chip_model:      Optional[str]
    chip_variant:    str
    cpu_mhz:         int
    ram_kb:          int
    flash_mb:        int
    psram_mb:        Optional[int]
    wifi:            bool
    bluetooth:       Optional[str]
    usb_native:      bool
    gpio_count:      int
    free_gpio_count: int
    has_display:     bool
    has_touch:       bool
    has_adc:         bool
    has_speaker:     bool
    image_url:       Optional[str]

    @classmethod
    def from_board(cls, b: Board) -> "BoardSummary":
        types = {c.type for c in b.builtin_components}
        return cls(
            id=b.id, name=b.name, aliases=b.aliases,
            manufacturer=b.manufacturer, category=b.category,
            esphome_board=b.esphome_board,
            chip_family=b.chip.family,
            chip_model=b.chip.model,
            chip_variant=b.chip.variant,
            cpu_mhz=b.chip.cpu_mhz,
            ram_kb=b.chip.ram_kb, flash_mb=b.chip.flash_mb,
            psram_mb=b.chip.psram_mb,
            wifi=b.chip.wifi,
            bluetooth=b.chip.bluetooth,
            usb_native=b.chip.usb_native,
            gpio_count=len(b.gpios),
            free_gpio_count=len(b.free_gpios()),
            has_display=ComponentType.DISPLAY in types,
            has_touch=ComponentType.TOUCHSCREEN in types,
            has_adc=any(g.adc is not None for g in b.gpios),
            has_speaker=ComponentType.MEDIA_PLAYER in types,
            image_url=b.image_url,
        )


class GpioConflictResult(BaseModel):
    gpio:       int
    available:  bool
    conflicts:  list[str] = []    # Beschreibungen der Konflikte
    warnings:   list[str] = []    # Warnungen (z.B. ADC2 + WiFi)
    suggestions: list[int] = []   # Alternative GPIOs
