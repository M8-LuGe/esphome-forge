import type { Board, BoardSummary, GpioConflictResult } from '@/types/board'
import { API_BASE } from './base'

// In HA Add-on läuft alles auf dem gleichen Origin.
// Im Ingress-Modus wird der Prefix automatisch erkannt.
const BASE = API_BASE

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

// ── Board API ──────────────────────────────────────────────────────────────

export const boardsApi = {
  list: (family?: string, hasDisplay?: boolean): Promise<BoardSummary[]> => {
    const params = new URLSearchParams()
    if (family)                    params.set('family', family)
    if (hasDisplay !== undefined)  params.set('has_display', String(hasDisplay))
    const qs = params.toString()
    return get<BoardSummary[]>(`/boards${qs ? '?' + qs : ''}`)
  },

  get: (id: string): Promise<Board> =>
    get<Board>(`/boards/${id}`),

  create: (board: Board): Promise<BoardSummary> =>
    post<BoardSummary>('/boards', board),

  delete: (id: string): Promise<void> =>
    del(`/boards/${id}`),

  gpios: (boardId: string) =>
    get<{
      board_id: string
      gpios: Board['gpios']
      free: number[]
      used: { gpio: number; comp: string; role: string }[]
      adc1_wifi_safe: number[]
      touch_capable: number[]
    }>(`/boards/${boardId}/gpios`),

  checkGpio: (
    boardId: string,
    gpioNum: number,
    opts: {
      need_output?: boolean
      need_input?: boolean
      need_adc?: boolean
      need_touch?: boolean
      need_pwm?: boolean
      wifi_active?: boolean
    } = {}
  ): Promise<GpioConflictResult> => {
    const params = new URLSearchParams(
      Object.entries(opts)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
    return get<GpioConflictResult>(
      `/boards/${boardId}/gpios/${gpioNum}/check?${params}`
    )
  },
}
