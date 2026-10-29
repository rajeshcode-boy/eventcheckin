import { isGaPath, isTrackedPath } from '@/lib/analytics'

describe('isGaPath', () => {
  it('allows only the public website pages', () => {
    for (const path of ['/', '/signup', '/login', '/privacy', '/terms']) expect(isGaPath(path)).toBe(true)
  })

  it('never includes the signed-in app or guest pages', () => {
    for (const path of ['/events', '/events/abc/guests', '/dashboard', '/profile', '/checkin/EVT1', '/pass/tok', '/kiosk', '/signup/extra']) {
      expect(isGaPath(path)).toBe(false)
    }
  })
})

describe('isTrackedPath', () => {
  it('tracks the public website and organiser pages', () => {
    for (const path of ['/', '/privacy', '/terms', '/login', '/signup', '/events', '/events/abc/guests', '/dashboard']) {
      expect(isTrackedPath(path)).toBe(true)
    }
  })

  it('never tracks guest-facing pages', () => {
    for (const path of ['/checkin/EVT1', '/register/tok', '/badge/tok', '/pass/tok', '/pass/tok/manifest.webmanifest', '/kiosk', '/api/checkin']) {
      expect(isTrackedPath(path)).toBe(false)
    }
  })

  it('does not treat lookalike paths as guest pages', () => {
    expect(isTrackedPath('/passwords')).toBe(true)
    expect(isTrackedPath('/kiosks-guide')).toBe(true)
  })
})
