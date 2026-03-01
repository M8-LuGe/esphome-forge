import type {
  ForgeProject,
  DeviceListItem,
  ForgeProjectCreate,
  ProjectComponent,
  EsphomeStatus,
  ActionResult,
  DiscoverResult,
  DeviceInfo,
} from '@/types/project'

import { API_BASE } from './base'

const BASE = API_BASE

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function getText(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.text()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
}

export const projectsApi = {
  /** Alle Geräte (Forge + externe ESPHome-Configs) */
  devices: (): Promise<DeviceListItem[]> =>
    get<DeviceListItem[]>('/projects/devices'),

  /** Nur Forge-Projekte */
  list: (): Promise<ForgeProject[]> =>
    get<ForgeProject[]>('/projects'),

  /** Einzelnes Forge-Projekt */
  get: (id: string): Promise<ForgeProject> =>
    get<ForgeProject>(`/projects/${id}`),

  /** Neues Forge-Projekt erstellen */
  create: (data: ForgeProjectCreate): Promise<ForgeProject> =>
    post<ForgeProject>('/projects', data),

  /** Forge-Projekt löschen */
  delete: (id: string): Promise<void> =>
    del(`/projects/${id}`),

  /** Komponenten eines Projekts aktualisieren (synct zum Backend + regeneriert YAML) */
  updateComponents: (id: string, components: ProjectComponent[]): Promise<ForgeProject> =>
    put<ForgeProject>(`/projects/${id}/components`, components),

  /** Generiertes ESPHome-YAML abrufen */
  getYaml: (id: string): Promise<string> =>
    getText(`/projects/${id}/yaml`),
}

// ── ESPHome Integration API ──────────────────────────────────────────────────

export const esphomeApi = {
  /** ESPHome-Addon-Status prüfen */
  status: (): Promise<EsphomeStatus> =>
    get<EsphomeStatus>('/esphome/status'),

  /** YAML kompilieren via ESPHome-Addon */
  compile: (projectId: string): Promise<ActionResult> =>
    post<ActionResult>(`/projects/${projectId}/compile`, {}),

  /** Firmware per OTA auf Device flashen */
  upload: (projectId: string, ip?: string): Promise<ActionResult> => {
    const params = ip ? `?ip=${encodeURIComponent(ip)}` : ''
    return post<ActionResult>(`/projects/${projectId}/upload${params}`, {})
  },

  /** Device-Infos abrufen (inkl. Online-Status) */
  getDevice: (projectId: string): Promise<DeviceInfo & { online: boolean }> =>
    get<DeviceInfo & { online: boolean }>(`/projects/${projectId}/device`),

  /** Device-Infos aktualisieren (z.B. IP setzen) */
  updateDevice: (projectId: string, update: Partial<DeviceInfo>): Promise<DeviceInfo> =>
    put<DeviceInfo>(`/projects/${projectId}/device`, update),

  /** Device-IP automatisch ermitteln */
  discover: (projectId: string): Promise<DiscoverResult> =>
    post<DiscoverResult>(`/projects/${projectId}/discover`, {}),

  /** Log-Stream URL (für EventSource) */
  logsUrl: (projectId: string): string =>
    `${BASE}/projects/${projectId}/logs`,
}
