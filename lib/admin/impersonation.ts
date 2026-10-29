// Shared between the admin page (starts a session) and the banner (ends one).
// Kept in sessionStorage only: it never survives closing the tab, and never reaches localStorage,
// so a stale "return session" can't linger on a shared machine.

export const IMPERSONATION_KEY = 'eventcheckin_impersonation'

export interface ImpersonationState {
  logId: string
  targetEmail: string
  targetName: string
  returnAccessToken: string
  returnRefreshToken: string
}

export function readImpersonation(): ImpersonationState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_KEY)
    return raw ? (JSON.parse(raw) as ImpersonationState) : null
  } catch {
    return null
  }
}

export function writeImpersonation(state: ImpersonationState) {
  window.sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state))
}

export function clearImpersonation() {
  window.sessionStorage.removeItem(IMPERSONATION_KEY)
}
