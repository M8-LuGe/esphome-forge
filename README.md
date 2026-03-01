# ESPHome Forge

> **Status: Phase 1 – Board-Datenbank & Add-on-Shell**

Visueller ESPHome-Konfigurator als natives Home Assistant Add-on.

## Vision

| Phase | Beschreibung | Status |
|-------|-------------|--------|
| 1 | HA Add-on Shell + Board-Datenbank API | 🚧 In Entwicklung |
| 2 | ESPHome Komponenten-Registry (alle ~300 Plattformen) | ⬜ Geplant |
| 3 | Visueller Konfigurator: Board-Bild + GPIO-Overlay + Picker | ⬜ Geplant |
| 4 | YAML-Generator + Live-Validierung | ⬜ Geplant |
| 5 | Flow-Editor + Blueprint-Compiler | ⬜ Geplant |

## Installation (HA Add-on Repository)

1. **Home Assistant** → Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories
2. URL eintragen: `https://github.com/DEIN_USER/esphome-forge`
3. **ESPHome Forge** Add-on installieren

## Entwicklung lokal

```bash
cd esphome-forge/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 7052
```

API-Docs: http://localhost:7052/docs

## Board-Datenbank beitragen

Neue Boards als JSON gemäß [`esphome-forge/backend/boards/data/board.schema.json`](esphome-forge/backend/boards/data/board.schema.json) im Verzeichnis `boards/data/` ablegen und Pull Request öffnen.

Validierung lokal:
```bash
python -m boards.registry --validate
```

## Projektstruktur

```
esphome-forge/          ← HA Add-on Verzeichnis
├── config.yaml         ← Add-on Manifest
├── Dockerfile
├── run.sh
├── backend/            ← Python FastAPI
│   ├── main.py
│   ├── boards/         ← Board-Datenbank
│   │   ├── schema.py   ← Pydantic-Modelle
│   │   ├── registry.py ← Laden, Validieren, Abfragen
│   │   └── data/       ← Board-JSON-Dateien
│   ├── components/     ← ESPHome Komponenten-Registry (Phase 2)
│   └── generator/      ← YAML-Generator (Phase 4)
└── frontend/           ← React + React Flow (Phase 3)
```
