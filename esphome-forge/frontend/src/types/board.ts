// ── Gespiegelt aus backend/boards/schema.py ────────────────────────────────

export type ChipFamily =
  | 'ESP32' | 'ESP32-S2' | 'ESP32-S3'
  | 'ESP32-C3' | 'ESP32-C6' | 'ESP32-H2' | 'ESP8266'

export type CpuArch = 'xtensa-lx6' | 'xtensa-lx7' | 'riscv'

export interface Chip {
  family:       ChipFamily
  model:        string
  variant:      string
  revision_min: number | null
  cpu_cores:    number
  cpu_arch:     CpuArch
  cpu_mhz:      number
  ram_kb:       number
  flash_mb:     number
  psram_mb:     number | null
  psram_mode:   'SPI' | 'QSPI' | 'OPI' | null
  wifi:         boolean
  bluetooth:    'BLE' | 'BT+BLE' | 'BT Classic' | null
  ethernet:     boolean
  usb_native:   boolean
}

export interface Power {
  voltage_logic:     number
  voltage_input_min: number
  voltage_input_max: number
}

export interface AdcInfo  { unit: number; ch: number; wifi_ok: boolean }
export interface DacInfo  { ch: number; note?: string }
export interface TouchInfo { ch: number }

export interface SpiHw    { bus: string; role: 'CLK' | 'MOSI' | 'MISO' | 'CS' }
export interface UartDef  { unit: number; role: 'TX' | 'RX' }

export interface BoardUsage { comp: string; role: string; note?: string }

export interface Gpio {
  num:          number
  labels:       string[]
  input:        boolean
  output:       boolean
  od:           boolean
  pu:           boolean
  pd:           boolean
  rtc:          boolean
  pwm:          boolean
  adc?:         AdcInfo | null
  dac?:         DacInfo | null
  touch?:       TouchInfo | null
  spi_hw?:      SpiHw | null
  i2c_default?: 'SDA' | 'SCL' | null
  uart_default?: UartDef | null
  strapping?:   string | null
  flash?:       boolean
  notes?:       string
  board_usage?: BoardUsage | null
}

export interface BuiltinPinRef { gpio: number; role: string; note?: string }

export interface BuiltinComponent {
  id:                 string
  type:               string
  name:               string
  esphome_platform?:  string
  esphome_model?:     string
  active_level?:      'high' | 'low'
  pins?:              Record<string, BuiltinPinRef>
  config?:            Record<string, unknown>
  optional?:          boolean
  notes?:             string
}

// ── Vollständiges Board (GET /api/boards/:id) ─────────────────────────────

export interface Board {
  id:                   string
  name:                 string
  aliases?:             string[]
  manufacturer?:        string
  category:             'devkit' | 'module' | 'complete-device' | 'custom'
  esphome_board:        string
  esphome_framework?:   string[]
  image_url?:           string
  datasheet_url?:       string
  purchase_urls?:       string[]
  chip:                 Chip
  power?:               Power
  gpios:                Gpio[]
  builtin_components?:  BuiltinComponent[]
  notes?:               string
  community_url?:       string
}

// ── Board-Zusammenfassung (GET /api/boards) ───────────────────────────────

export interface BoardSummary {
  id:              string
  name:            string
  aliases:         string[]
  manufacturer:    string | null
  category:        string
  esphome_board:   string
  chip_family:     ChipFamily
  chip_model:      string | null
  chip_variant:    string
  cpu_mhz:         number
  ram_kb:          number
  flash_mb:        number
  psram_mb:        number | null
  wifi:            boolean
  bluetooth:       string | null
  usb_native:      boolean
  gpio_count:      number
  free_gpio_count: number
  has_display:     boolean
  has_touch:       boolean
  has_adc:         boolean
  has_speaker:     boolean
  image_url:       string | null
}

// ── GPIO-Konfliktprüfung (GET /api/boards/:id/gpios/:num/check) ──────────

export interface GpioConflictResult {
  gpio:        number
  available:   boolean
  conflicts:   string[]
  warnings:    string[]
  suggestions: number[]
}
