#!/usr/bin/with-contenv bashio

bashio::log.info "Starting ESPHome Forge v$(bashio::addon.version)..."

# Sicherstellen dass custom boards Verzeichnis existiert
mkdir -p /share/esphome-forge/custom_boards

# Backend starten
cd /app/backend
exec python3 -m uvicorn main:app \
    --host 0.0.0.0 \
    --port 7052 \
    --log-level info
