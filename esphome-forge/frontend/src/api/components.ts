import type {
  ComponentSummary,
  ComponentDetail,
  ComponentCategoryInfo,
  CustomComponent,
  CustomComponentCreate,
} from '@/types/component'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
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

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
}

// ── Components API ──────────────────────────────────────────────────────────

export const componentsApi = {
  /** Alle Komponenten (optional gefiltert) */
  list: (opts?: {
    category?: string
    platform?: string
    bus?: string
    q?: string
  }): Promise<ComponentSummary[]> => {
    const params = new URLSearchParams()
    if (opts?.category)  params.set('category', opts.category)
    if (opts?.platform)  params.set('platform', opts.platform)
    if (opts?.bus)       params.set('bus', opts.bus)
    if (opts?.q)         params.set('q', opts.q)
    const qs = params.toString()
    return get<ComponentSummary[]>(`/components${qs ? '?' + qs : ''}`)
  },

  /** Alle Kategorien mit Anzahl */
  categories: (): Promise<ComponentCategoryInfo[]> =>
    get<ComponentCategoryInfo[]>('/components/categories'),

  /** Komponentendetails */
  get: (id: string): Promise<ComponentDetail> =>
    get<ComponentDetail>(`/components/${id}`),

  /** Custom-Component erstellen */
  createCustom: (data: CustomComponentCreate): Promise<CustomComponent> =>
    post<CustomComponent>('/components/custom', data),

  /** Custom-Component löschen */
  deleteCustom: (id: string): Promise<void> =>
    del(`/components/custom/${id}`),

  /** Schema-Cache neu laden */
  refresh: (): Promise<{ status: string }> =>
    post<{ status: string }>('/components/refresh', {}),
}
