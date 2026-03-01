# ESPHome Forge

> **Visueller ESPHome-Konfigurator als natives Home Assistant Add-on**

Board auswählen → GPIOs verwalten → Komponenten konfigurieren → YAML generieren → Kompilieren & Flashen — alles in einem UI.

## Features

- 🔧 **Board-Datenbank** mit GPIO-Matrix, Pin-Modes, Konflikterkennung
- 🧩 **300+ ESPHome-Komponenten** durchsuchen, filtern, hinzufügen
- 📌 **Pin-Konfigurator** mit Modus-Filterung und Duplikat-Erkennung
- 📄 **YAML-Generator** — vollständiges ESPHome-YAML aus dem visuellen Editor
- 🔗 **Device-Kopplung** — API-Key + OTA-Passwort werden automatisch generiert
- 🚀 **Compile & Flash** — delegiert an das ESPHome-Addon (OTA-Upload direkt aus Forge)
- 🏠 **HA Ingress** — nahtlos in die Home Assistant Sidebar integriert

## Installation

1. **Home Assistant** → Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories
2. URL eintragen:
   ```
   https://github.com/M8-LuGe/esphome-forge
   ```
3. **ESPHome Forge** Add-on installieren & starten
4. In der Sidebar auf **ESPHome Forge** klicken

> **Voraussetzung für Compile & Flash:** Das offizielle ESPHome-Addon muss installiert und gestartet sein.

## Entwicklung lokal

### Backend
```bash
cd esphome-forge/backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 7052
```

### Frontend
```bash
cd esphome-forge/frontend
npm install
npm run dev
```

API-Docs: http://localhost:7052/docs
Frontend-Dev: http://localhost:5173

## Projektstruktur

```
esphome-forge/              ← HA Add-on Verzeichnis
├── config.yaml             ← Add-on Manifest
├── build.yaml              ← Multi-Arch Build-Config
├── Dockerfile
├── run.sh
├── backend/
│   ├── main.py             ← FastAPI App + alle Endpunkte
│   ├── esphome_proxy.py    ← ESPHome-Addon-Integration (Compile/OTA)
│   ├── boards/             ← Board-Datenbank + GPIO-Schema
│   ├── components/         ← ESPHome Komponenten-Registry
│   └── projects/           ← Projekt-Verwaltung + YAML-Builder
└── frontend/
    └── src/
        ├── api/            ← API-Client (boards, projects, esphome)
        ├── components/     ← React-Komponenten (BoardDetail, GpioMatrix, DevicePanel, …)
        ├── store/          ← Zustand Store (Wizard-Steps, Projekt-State)
        └── types/          ← TypeScript-Interfaces
```

## Lizenz

MIT
