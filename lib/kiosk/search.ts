import type { KioskGuest } from './types'

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim()

// True when every character of `needle` appears in `hay` in order ("jsmth" matches "john smith")
function subsequence(needle: string, hay: string): boolean {
  let i = 0
  for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true
  return needle.length === 0
}

function score(q: string, g: KioskGuest): number {
  const code = g.registration_id.toLowerCase()
  if (code === q) return 100
  const name = norm(g.full_name)
  const email = (g.email ?? '').toLowerCase()
  if (email === q) return 95
  if (name === q) return 90
  if (name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q))) return 80
  if (code.startsWith(q)) return 75
  if (email.startsWith(q)) return 70
  if (name.includes(q) || email.includes(q)) return 60
  if (q.length >= 3 && (subsequence(q, name) || subsequence(q, email))) return 30
  return 0
}

// Instant client-side search over the cached guest list: name, email or confirmation code.
export function searchGuests(guests: KioskGuest[], query: string, limit = 8): KioskGuest[] {
  const q = norm(query)
  if (!q) return []
  return guests
    .map((g) => ({ g, s: score(q, g) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.g.full_name.localeCompare(b.g.full_name))
    .slice(0, limit)
    .map((x) => x.g)
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Turns whatever a scanner or the search box produced into a guest: a badge link/token or a confirmation code.
export async function matchScan(guests: KioskGuest[], raw: string): Promise<KioskGuest | null> {
  const text = raw.trim()
  if (!text) return null
  const link = text.match(/\/badge\/([A-Za-z0-9]+)/)
  const token = link ? link[1]! : /^[A-Za-z0-9]{32}$/.test(text) ? text : null
  if (token) {
    const hash = await sha256Hex(token)
    return guests.find((g) => g.badge_hash === hash) ?? null
  }
  const code = text.toUpperCase()
  return guests.find((g) => g.registration_id === code) ?? null
}
