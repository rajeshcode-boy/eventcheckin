import type { PostHog } from 'posthog-js'

export const CONSENT_KEY = 'analytics-consent'
export const CONSENT_EVENT = 'analytics-consent-change'
export type Consent = 'granted' | 'denied'

// Guest-facing pages carry guests' personal details and are never tracked
const UNTRACKED_PREFIXES = ['/checkin', '/register', '/badge', '/pass', '/kiosk', '/api']

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

export function writeConsent(consent: Consent | null) {
  try {
    if (consent) localStorage.setItem(CONSENT_KEY, consent)
    else localStorage.removeItem(CONSENT_KEY)
  } catch {
    // Storage blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent<Consent | null>(CONSENT_EVENT, { detail: consent }))
}

// posthog-js is downloaded only after a visitor accepts, so it stays out of the page bundle
let client: PostHog | null = null

export async function loadPostHog(): Promise<PostHog> {
  if (!client) client = (await import('posthog-js')).default
  return client
}

export function loadedPostHog(): PostHog | null {
  return client?.__loaded ? client : null
}

// Organisers are identified by their account ID only, never by name or email.
// Kept here so an identify that happens before consent is applied once PostHog loads.
let organiserId: string | null = null

export function identifyOrganiser(id: string) {
  organiserId = id
  loadedPostHog()?.identify(id)
}

export function pendingOrganiserId() {
  return organiserId
}

export function resetAnalytics() {
  organiserId = null
  loadedPostHog()?.reset()
}
