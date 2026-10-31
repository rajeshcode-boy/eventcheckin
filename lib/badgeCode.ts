export type BadgeCode = { kind: 'token' | 'reg'; value: string } | { kind: 'unknown' }

// Reads what staff scan or type at the desk: a badge or pass link, a bare 32-character badge
// token, or a registration ID. Any other link is someone else's QR code.
export function parseBadgeCode(input: string): BadgeCode | null {
  const text = input.trim()
  if (!text) return null
  const linkMatch = text.match(/\/(?:badge|pass)\/([A-Za-z0-9]{32})(?:[/?#]|$)/)
  if (linkMatch) return { kind: 'token', value: linkMatch[1]! }
  if (/^[A-Za-z0-9]{32}$/.test(text)) return { kind: 'token', value: text }
  if (/^[A-Za-z0-9-]{1,20}$/.test(text)) return { kind: 'reg', value: text.toUpperCase() }
  return { kind: 'unknown' }
}
