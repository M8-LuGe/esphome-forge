"""
Pydantic v2 Modelle für ESPHome Forge Projekte.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class ProjectComponent(BaseModel):
    """Eine dem Projekt hinzugefügte Komponente mit Pin-Zuweisungen."""
    uid:        str = Field(..., description="Eindeutige UUID der Instanz")
    comp_type:  str = Field(..., description="ESPHome component ID, z.B. 'dht'")
    name:       str = Field(..., description="Benutzerfreundlicher Name")
    pins:       dict[str, int] = Field(default_factory=dict, description="role → GPIO-Nummer")
    ha_visible: bool = Field(True, description="In Home Assistant sichtbar")
    config:     dict[str, object] = Field(default_factory=dict, description="Zusätzliche Config-Werte")


# ── Device-Kopplung ───────────────────────────────────────────────────────────

class DeviceInfo(BaseModel):
    """ESPHome-Gerätedaten – koppelt ein Forge-Projekt an ein physisches Device."""
    api_key:        str = Field("", description="API-Encryption-Key (Base64, 32 Bytes)")
    ota_password:   str = Field("", description="OTA-Update-Passwort")
    device_ip:      Optional[str] = Field(None, description="Letzte bekannte IP (mDNS / statisch)")
    mdns_name:      Optional[str] = Field(None, description="mDNS-Hostname (z.B. 'wohnzimmer-sensor.local')")
    esphome_name:   str = Field("", description="ESPHome device-name (= project.id)")
    last_seen:      Optional[str] = Field(None, description="Letzter erfolgreicher Kontakt (ISO-8601)")
    firmware_version: Optional[str] = Field(None, description="Letzte kompilierte ESPHome-Version")
    compile_status: str = Field("none", description="none | compiling | compiled | error")
    last_compile:   Optional[str] = Field(None, description="Letzter Compile-Zeitpunkt (ISO-8601)")
    last_upload:    Optional[str] = Field(None, description="Letzter Upload-Zeitpunkt (ISO-8601)")


class ForgeProject(BaseModel):
    """Ein von Forge verwaltetes ESPHome-Projekt."""
    id:              str
    name:            str
    board_id:        str
    board_name:      str
    chip_family:     str
    esphome_board:   str
    created_by_forge: bool = True
    created_at:      str          # ISO-8601
    updated_at:      str          # ISO-8601
    components:      list[ProjectComponent] = Field(default_factory=list)
    device:          DeviceInfo = Field(default_factory=DeviceInfo)


class ForgeProjectCreate(BaseModel):
    """Request-Body zum Erstellen eines neuen Projekts."""
    name:     str
    board_id: str


class DeviceListItem(BaseModel):
    """Einheitliches Modell für die Geräteliste (Forge + externe ESPHome-Configs)."""
    id:               str
    name:             str
    board_id:         Optional[str] = None
    board_name:       Optional[str] = None
    chip_family:      Optional[str] = None
    created_by_forge: bool = False
    created_at:       Optional[str] = None
    yaml_exists:      bool = False
    device_ip:        Optional[str] = None
    compile_status:   Optional[str] = None
