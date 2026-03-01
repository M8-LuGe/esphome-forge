/**
 * Generates a UUID v4.
 * Uses crypto.randomUUID() when available (HTTPS / localhost),
 * falls back to crypto.getRandomValues() which works in all contexts
 * including HA Ingress (HTTP).
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC 4122 v4 via getRandomValues (works over HTTP)
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
    const n = Number(c)
    return (n ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))).toString(16)
  })
}
