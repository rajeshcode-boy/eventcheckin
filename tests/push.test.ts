import { isIOSDevice, pushState, urlBase64ToUint8Array, type PushEnvironment } from '../lib/push/capability'

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36'
const DESKTOP_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

function env(overrides: Partial<PushEnvironment> = {}): PushEnvironment {
  return {
    userAgent: ANDROID_UA,
    maxTouchPoints: 5,
    standalone: false,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    ...overrides,
  }
}

describe('isIOSDevice', () => {
  test('detects iPhone and iPod', () => {
    expect(isIOSDevice(IPHONE_UA, 5)).toBe(true)
    expect(isIOSDevice('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 5)).toBe(true)
  })

  test('detects iPadOS that reports a Mac user agent', () => {
    expect(isIOSDevice(IPAD_DESKTOP_UA, 5)).toBe(true)
  })

  test('does not treat a desktop Mac or Android as iOS', () => {
    expect(isIOSDevice(DESKTOP_MAC_UA, 0)).toBe(false)
    expect(isIOSDevice(ANDROID_UA, 5)).toBe(false)
  })
})

describe('pushState', () => {
  test('not configured when the build has no VAPID key', () => {
    expect(pushState(env(), 'granted', true, false)).toBe('not-configured')
  })

  test('iPhone in a Safari tab needs the home-screen install before anything else', () => {
    const iosTab = env({ userAgent: IPHONE_UA, standalone: false, hasPushManager: false })
    expect(pushState(iosTab, 'default', false, true)).toBe('ios-install')
    expect(pushState(iosTab, 'denied', false, true)).toBe('ios-install')
  })

  test('iPhone opened from the home screen can subscribe', () => {
    const iosApp = env({ userAgent: IPHONE_UA, standalone: true })
    expect(pushState(iosApp, 'default', false, true)).toBe('off')
    expect(pushState(iosApp, 'granted', true, true)).toBe('on')
  })

  test('browser without push support is unsupported', () => {
    expect(pushState(env({ hasPushManager: false }), 'default', false, true)).toBe('unsupported')
    expect(pushState(env({ hasServiceWorker: false }), 'default', false, true)).toBe('unsupported')
  })

  test('denied permission is reported as denied', () => {
    expect(pushState(env({ userAgent: DESKTOP_MAC_UA, maxTouchPoints: 0 }), 'denied', false, true)).toBe('denied')
  })

  test('granted and subscribed is on; granted without a subscription is off', () => {
    expect(pushState(env(), 'granted', true, true)).toBe('on')
    expect(pushState(env(), 'granted', false, true)).toBe('off')
    expect(pushState(env(), 'default', false, true)).toBe('off')
  })
})

describe('urlBase64ToUint8Array', () => {
  test('decodes base64url without padding', () => {
    // "hi?" in base64url is "aGk_"; the standard form "aGk/" also decodes the same way
    const bytes = urlBase64ToUint8Array('aGk_')
    expect(Array.from(bytes)).toEqual([0x68, 0x69, 0x3f])
  })

  test('accepts - and _ in place of + and /', () => {
    // 0xfb 0xff decodes to "+/8" in standard base64, "-_8" in base64url
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff])
  })
})
