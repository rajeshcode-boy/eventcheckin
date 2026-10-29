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

const FACING_KEY = 'eventcheckin.kiosk.facing'

// Which camera this tablet scans with. A tablet on a stand uses the front camera, a phone the back.
export function loadFacing(): 'environment' | 'user' {
  try {
    return localStorage.getItem(FACING_KEY) === 'user' ? 'user' : 'environment'
  } catch {
    return 'environment'
  }
}

export function saveFacing(f: 'environment' | 'user') {
  try {
    localStorage.setItem(FACING_KEY, f)
  } catch {}
}
