import type { KioskSession } from './types'

const KEY = 'eventcheckin.kiosk.session'

export function loadSession(): KioskSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as KioskSession) : null
  } catch {
    return null
  }
}

export function saveSession(s: KioskSession) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
