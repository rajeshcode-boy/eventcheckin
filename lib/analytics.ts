import type { PostHog } from 'posthog-js'

export const CONSENT_KEY = 'analytics-consent'
export const CONSENT_EVENT = 'analytics-consent-change'
export type Consent = 'granted' | 'denied'

// Guest-facing pages carry guests' personal details and are never tracked
const UNTRACKED_PREFIXES = ['/checkin', '/register', '/badge', '/pass', '/kiosk', '/api']

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

// Google Analytics only ever sees the public website, never the signed-in app
const GA_PATHS = ['/', '/signup', '/login', '/privacy', '/terms']

export function isGaPath(pathname: string): boolean {
  return GA_PATHS.includes(pathname)
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } & Record<string, unknown>

// Loads gtag.js once. send_page_view is off so page views are sent by hand, only on GA_PATHS.
export function loadGoogleAnalytics(id: string) {
  const w = window as unknown as GtagWindow
  if (w.gtag) return
  w.dataLayer = w.dataLayer || []
  w.gtag = function gtag() {
    // gtag.js reads the arguments object itself, not an array
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  w.gtag('js', new Date())
  w.gtag('config', id, { send_page_view: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
}

// Google's own switch: while true, gtag.js sends nothing, including its automatic history page views
export function setGoogleAnalyticsEnabled(id: string, enabled: boolean) {
  ;(window as unknown as GtagWindow)[`ga-disable-${id}`] = !enabled
}

export function sendGooglePageView(id: string) {
  const w = window as unknown as GtagWindow
  w.gtag?.('event', 'page_view', {
    send_to: id,
    page_path: window.location.pathname,
    page_location: window.location.origin + window.location.pathname,
    page_title: document.title,
  })
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
