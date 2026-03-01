# Changelog

## [0.1.0] – 2026-03-01

### Hinzugefügt
- HA Add-on Shell (ingress, Sidebar-Icon)
- Board-Datenbank API (`GET /api/boards`, `GET /api/boards/{id}`)
- Initiale Board-Daten: ESP32-WROOM-32, ESP32-2432S028R (CYD), ESP32-C3 Super Mini
- JSON Schema für Board-Definitionen (`board.schema.json`)
- GPIO-Capabilities-Matrix inkl. ADC/DAC/Touch/SPI/I2C/UART pro Pin
- Built-in-Komponenten-Mapping pro Board
- Custom Board API (`POST /api/boards`, persistent in `/share/esphome-forge/`)
- GPIO-Konflikt-Check (`GET /api/boards/{id}/gpios/{num}/check`)
