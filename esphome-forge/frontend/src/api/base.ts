/**
 * API-Base-URL – funktioniert sowohl lokal (Dev) als auch im HA Ingress.
 *
 * Ingress-Modus:  /api/hassio_ingress/{token}/api/boards  →  fetch("/api/hassio_ingress/{token}/api/boards")
 * Dev-Modus:      /api/boards  →  vite proxy → localhost:7052/api/boards
 *
 * Strategie: Wir lesen den aktuellen window.location.pathname und schauen ob
 * er mit /api/hassio_ingress/ anfängt.  Falls ja, verwenden wir den Prefix.
 */

function detectIngressPath(): string {
  // HA Ingress setzt den Path auf /api/hassio_ingress/<TOKEN>/
  const match = window.location.pathname.match(
    /^(\/api\/hassio_ingress\/[^/]+)/
  )
  if (match) return match[1]

  // Fallback: kein Ingress → leerer Prefix (relative API calls)
  return ''
}

/** Gecachter Ingress-Prefix (einmal berechnet) */
const INGRESS_PREFIX = detectIngressPath()

/**
 * Basis-URL für alle API-Requests.
 * - Ingress: "/api/hassio_ingress/{token}/api"
 * - Dev/Direct: "/api"
 */
export const API_BASE = `${INGRESS_PREFIX}/api`

/**
 * Basis-URL für EventSource (SSE-Streams).
 * Gleicher Prefix, aber nützlich als separate Konstante.
 */
export const SSE_BASE = `${INGRESS_PREFIX}/api`

/** Hilfsfunktion: Vollständige URL für einen API-Pfad */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

/** Hilfsfunktion: Vollständige URL für einen SSE-Endpunkt */
export function sseUrl(path: string): string {
  return `${SSE_BASE}${path}`
}
