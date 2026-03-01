// ── Gespiegelt aus backend/components/schema.py ─────────────────────────────

export interface ConfigField {
  key:         string
  required:    boolean
  type:        string   // string | integer | boolean | enum | pin | schema | use_id
  default?:    string | null
  description?: string | null
  enum_values?: string[] | null
  pin_modes?:  string[] | null  // GPIO modes needed: ['input','pullup'], ['output'], etc.
  internal?:   boolean          // Internal pin schema (not raw int)
}

export interface ComponentSummary {
  id:            string
  name:          string
  platform_type: string | null
  category:      string
  bus_type:      string | null
  description:   string | null
  icon:          string | null
  doc_url:       string | null
  dependencies:  string[]
  is_platform:   boolean
  is_custom:     boolean
}

export interface ComponentDetail extends ComponentSummary {
  config_fields:  ConfigField[]
  sub_sensors:    string[]
  auto_load:      string[]
  device_classes: string[]
  chip_families:  string[] | null
  raw_schema:     Record<string, unknown> | null
}

export interface ComponentCategoryInfo {
  id:    string
  name:  string
  icon:  string
  count: number
}

export interface CustomComponentCreate {
  id:               string
  name:             string
  platform_type?:   string | null
  category?:        string
  bus_type?:        string | null
  description?:     string | null
  doc_url?:         string | null
  yaml_snippet:     string
  external_source?: string | null
}

export interface CustomComponent {
  id:              string
  name:            string
  platform_type:   string | null
  category:        string
  bus_type:        string | null
  description:     string | null
  doc_url:         string | null
  yaml_snippet:    string
  external_source: string | null
  created_at:      string
}
