"""
Pydantic v2 Modelle für die ESPHome Forge Component-Registry.

Die Daten stammen primär aus dem esphome-schema Repository (JSON-Schemas),
ergänzt durch kuratierte Enrichment-Daten (Kategorie, Icons, freundliche Namen).
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────────

class PlatformType(str, Enum):
    """ESPHome platform types (IS_PLATFORM_COMPONENT = True)."""
    SENSOR          = "sensor"
    BINARY_SENSOR   = "binary_sensor"
    TEXT_SENSOR      = "text_sensor"
    CLIMATE         = "climate"
    COVER           = "cover"
    FAN             = "fan"
    LIGHT           = "light"
    SWITCH          = "switch"
    BUTTON          = "button"
    NUMBER          = "number"
    SELECT          = "select"
    TEXT            = "text"
    LOCK            = "lock"
    VALVE           = "valve"
    ALARM_CONTROL_PANEL = "alarm_control_panel"
    MEDIA_PLAYER    = "media_player"
    SPEAKER         = "speaker"
    MICROPHONE      = "microphone"
    EVENT           = "event"
    UPDATE          = "update"
    DATETIME        = "datetime"
    DISPLAY         = "display"
    TOUCHSCREEN     = "touchscreen"
    OUTPUT          = "output"
    TIME            = "time"
    WATER_HEATER    = "water_heater"
    AUDIO_ADC       = "audio_adc"
    AUDIO_DAC       = "audio_dac"


class ComponentCategory(str, Enum):
    """Kuratierte Kategorien für die UI."""
    SENSOR_ENVIRONMENTAL = "sensor-environmental"
    SENSOR_LIGHT         = "sensor-light"
    SENSOR_MOTION        = "sensor-motion"
    SENSOR_DISTANCE      = "sensor-distance"
    SENSOR_ELECTRICITY   = "sensor-electricity"
    SENSOR_AIR_QUALITY   = "sensor-air-quality"
    SENSOR_ANALOG        = "sensor-analog"
    SENSOR_MISC          = "sensor-misc"
    BINARY_SENSOR        = "binary-sensor"
    DISPLAY              = "display"
    LIGHT                = "light"
    SWITCH               = "switch"
    CLIMATE              = "climate"
    COVER                = "cover"
    FAN                  = "fan"
    MEDIA_AUDIO          = "media-audio"
    OUTPUT               = "output"
    BUTTON               = "button"
    NUMBER_SELECT        = "number-select"
    TIME                 = "time"
    BUS_INTERFACE        = "bus-interface"
    IO_EXPANDER          = "io-expander"
    NETWORK              = "network"
    BLUETOOTH            = "bluetooth"
    WIRELESS             = "wireless"
    CORE                 = "core"
    MISC                 = "misc"
    CUSTOM               = "custom"


class BusType(str, Enum):
    """Welchen Hardware-Bus benötigt die Komponente."""
    GPIO  = "gpio"
    I2C   = "i2c"
    SPI   = "spi"
    UART  = "uart"
    ONE_WIRE = "1wire"
    BLE   = "ble"
    WIFI  = "wifi"
    CAN   = "can"
    I2S   = "i2s"
    NONE  = "none"


# ── Config-Schema (vereinfacht für UI) ─────────────────────────────────────

class ConfigField(BaseModel):
    """Einzelnes Konfigurationsfeld einer Komponente, vereinfacht für die UI."""
    key:          str
    required:     bool = False
    type:         str = "string"   # string | integer | boolean | enum | pin | schema | use_id
    default:      Optional[str] = None
    description:  Optional[str] = None
    enum_values:  Optional[list[str]] = None
    pin_modes:    Optional[list[str]] = Field(None, description="Benötigte GPIO-Modi für Pin-Felder, z.B. ['input','pullup']")
    internal:     bool = Field(False, description="Internes Feld (z.B. Pin-Schema, nicht raw int)")


# ── Haupt-Modelle ──────────────────────────────────────────────────────────

class ComponentSummary(BaseModel):
    """Kompakte Darstellung für die Komponentenliste."""
    id:             str = Field(..., description="ESPHome component ID, z.B. 'dht'")
    name:           str = Field(..., description="Benutzerfreundlicher Name")
    platform_type:  Optional[str] = Field(None, description="Platform-Typ (sensor, light, etc.)")
    category:       str = Field("misc", description="Kuratierte Kategorie")
    bus_type:       Optional[str] = Field(None, description="Benötigter Bus")
    description:    Optional[str] = Field(None, description="Kurzbeschreibung")
    icon:           Optional[str] = Field(None, description="Lucide-Icon Name")
    doc_url:        Optional[str] = Field(None, description="Link zur ESPHome-Doku")
    dependencies:   list[str] = Field(default_factory=list)
    is_platform:    bool = Field(False, description="Ist ein Platform-Component (sensor, binary_sensor, ...)")
    is_custom:      bool = Field(False, description="Benutzerdefinierte Komponente")


class ComponentDetail(ComponentSummary):
    """Vollständige Darstellung inkl. vereinfachtem Config-Schema."""
    config_fields:    list[ConfigField] = Field(default_factory=list)
    sub_sensors:      list[str] = Field(default_factory=list, description="Sub-Entities, z.B. temperature, humidity")
    auto_load:        list[str] = Field(default_factory=list)
    device_classes:   list[str] = Field(default_factory=list, description="HA device classes")
    chip_families:    Optional[list[str]] = Field(None, description="Einschränkung auf bestimmte Chip-Familien (None = alle)")
    raw_schema:       Optional[dict] = Field(None, description="Originales JSON-Schema (für Debug)")


# ── Custom Components ──────────────────────────────────────────────────────

class CustomComponentCreate(BaseModel):
    """Request zum Anlegen einer benutzerdefinierten Komponente."""
    id:             str = Field(..., description="Eindeutige ID, z.B. 'my_sensor'")
    name:           str = Field(..., description="Anzeigename")
    platform_type:  Optional[str] = Field(None, description="Platform-Typ")
    category:       str = Field("custom")
    bus_type:       Optional[str] = Field(None)
    description:    Optional[str] = None
    doc_url:        Optional[str] = None
    yaml_snippet:   str = Field(..., description="YAML-Block der ins Projekt eingebettet wird")
    external_source: Optional[str] = Field(None, description="GitHub-URL für external_components")


class CustomComponent(BaseModel):
    """Persistierte Custom-Komponente."""
    id:              str
    name:            str
    platform_type:   Optional[str] = None
    category:        str = "custom"
    bus_type:        Optional[str] = None
    description:     Optional[str] = None
    doc_url:         Optional[str] = None
    yaml_snippet:    str = ""
    external_source: Optional[str] = None
    created_at:      str = ""


class ComponentCategoryInfo(BaseModel):
    """Info über eine Kategorie für die UI."""
    id:    str
    name:  str
    icon:  str
    count: int = 0
