// ── Projekt-Komponente (in ForgeProject.components) ───────────────────────────

export interface ProjectComponent {
  uid:        string
  comp_type:  string
  name:       string
  pins:       Record<string, number>
  ha_visible: boolean
  config:     Record<string, unknown>
}

// ── Device-Kopplung ──────────────────────────────────────────────────────────

export interface DeviceInfo {
  api_key:          string
  ota_password:     string
  device_ip:        string | null
  mdns_name:        string | null
  esphome_name:     string
  last_seen:        string | null
  firmware_version: string | null
  compile_status:   'none' | 'compiling' | 'compiled' | 'error'
  last_compile:     string | null
  last_upload:      string | null
}

// ── Forge-Projekt (POST/GET /api/projects) ──────────────────────────────

export interface ForgeProject {
  id:               string
  name:             string
  board_id:         string
  board_name:       string
  chip_family:      string
  esphome_board:    string
  created_by_forge: boolean
  created_at:       string
  updated_at:       string
  components:       ProjectComponent[]
  device:           DeviceInfo
}

export interface ForgeProjectCreate {
  name:     string
  board_id: string
}

// ── Geräteliste (GET /api/projects/devices) ──────────────────────────────────

export interface DeviceListItem {
  id:               string
  name:             string
  board_id:         string | null
  board_name:       string | null
  chip_family:      string | null
  created_by_forge: boolean
  created_at:       string | null
  yaml_exists:      boolean
  device_ip:        string | null
  compile_status:   string | null
}

// ── ESPHome Status ───────────────────────────────────────────────────────────

export interface EsphomeStatus {
  supervisor_available: boolean
  esphome_available:    boolean
  esphome_running:      boolean
  esphome_version:      string | null
  addon_slug:           string | null
}

// ── Compile/Upload Result ────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  message?: string
  error?:   string
  detail?:  string
}

// ── Device Discovery ─────────────────────────────────────────────────────────

export interface DiscoverResult {
  found:  boolean
  ip:     string | null
  online: boolean
}
