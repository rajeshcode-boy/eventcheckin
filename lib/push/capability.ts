// What this device can do with web push, and what the notification card should say.
// Kept free of browser and Node APIs so it can be unit tested.

export interface PushEnvironment {
  userAgent: string
  maxTouchPoints: number
  // Opened from the home screen (display-mode: standalone, or iOS navigator.standalone)
  standalone: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
}

export type PushState =
  | 'not-configured' // no VAPID public key in this build
  | 'unsupported' // browser has no service worker, push or notifications
  | 'ios-install' // iPhone/iPad in Safari tab: push only works after Add to Home Screen
  | 'denied' // the user blocked notifications for this site
  | 'off' // allowed or not yet asked, not subscribed
  | 'on' // subscribed

// iPadOS 13+ reports a desktop Mac user agent, so a touch-capable "Mac" is an iPad
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export function pushState(
  env: PushEnvironment,
  permission: NotificationPermission,
  subscribed: boolean,
  configured: boolean
): PushState {
  if (!configured) return 'not-configured'
  if (isIOSDevice(env.userAgent, env.maxTouchPoints) && !env.standalone) return 'ios-install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  if (permission === 'denied') return 'denied'
  return subscribed && permission === 'granted' ? 'on' : 'off'
}

// The VAPID public key is base64url; PushManager needs the raw bytes
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
