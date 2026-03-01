#!/bin/bash
# shellcheck shell=bash
# Load bashio helper library (available in all HA base images)
# shellcheck source=/dev/null
. /usr/lib/bashio/bashio.sh

bashio::log.info "Starting ESPHome Forge v$(bashio::addon.version)..."

# Sicherstellen, dass Verzeichnisse existieren
mkdir -p /share/esphome-forge/custom_boards
mkdir -p /share/esphome-forge/projects

# Ingress-Pfad von HA auslesen (für root_path)
INGRESS_ENTRY=$(bashio::addon.ingress_entry 2>/dev/null || echo "")
bashio::log.info "Ingress entry: ${INGRESS_ENTRY:-none}"

# Backend starten
cd /app/backend

if [ -n "${INGRESS_ENTRY}" ]; then
  bashio::log.info "Running with root-path: ${INGRESS_ENTRY}"
  exec python3 -m uvicorn main:app \
      --host 0.0.0.0 \
      --port 7052 \
      --root-path "${INGRESS_ENTRY}" \
      --log-level info
else
  exec python3 -m uvicorn main:app \
      --host 0.0.0.0 \
      --port 7052 \
      --log-level info
fi
