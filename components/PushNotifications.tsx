'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isIOSDevice, pushState, urlBase64ToUint8Array, type PushState } from '@/lib/push/capability'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

interface Props {
  // Organisers are signed in and get notifications on their devices. Guests use their badge link.
  mode: 'organizer' | 'guest'
  badgeToken?: string
}

function readEnvironment() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
  }
}

const STATUS_TEXT: Record<PushState, string> = {
  'not-configured': 'Notifications are not set up for this site yet.',
  unsupported: "This browser can't show web notifications.",
  'ios-install': 'On iPhone, notifications work once EventCheckin is added to your Home Screen.',
  denied: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then reload this page.',
  off: 'Get a notification when something needs your attention on this device.',
  on: 'Notifications are on for this device.',
}

// Checking state shown until the browser tells us the real state
export default function PushNotifications({ mode, badgeToken }: Props) {
  const [state, setState] = useState<PushState | 'checking'>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function currentSubscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.register('/sw.js')
    return registration.pushManager.getSubscription()
  }

  async function refresh() {
    const env = readEnvironment()
    const configured = VAPID_PUBLIC_KEY !== ''
    // On iPhone outside the home screen the service worker cannot be used for push, so skip it
    const canUseWorker = env.hasServiceWorker && env.hasPushManager && configured
      && !(isIOSDevice(env.userAgent, env.maxTouchPoints) && !env.standalone)
    const subscribed = canUseWorker ? (await currentSubscription()) !== null : false
    const permission = 'Notification' in window ? Notification.permission : 'default'
    setState(pushState(env, permission, subscribed, configured))
  }

  useEffect(() => {
    refresh().catch(() => setState('unsupported'))
    // refresh reads browser state only; it is safe to run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function turnOn() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      // Must run from this tap: iOS and other browsers only show the prompt after a user gesture
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        await refresh()
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      const json = subscription.toJSON()
      const keys = json.keys ?? {}
      const args = {
        p_endpoint: subscription.endpoint,
        p_p256dh: keys.p256dh ?? '',
        p_auth: keys.auth ?? '',
        p_user_agent: navigator.userAgent.slice(0, 300),
      }
      const { error: saveError } = mode === 'organizer'
        ? await supabase.rpc('save_push_subscription', args)
        : await supabase.rpc('public_subscribe_guest', { p_badge_token: badgeToken ?? '', ...args })
      if (saveError) {
        // Do not leave a device subscribed that the server does not know about
        await subscription.unsubscribe()
        setError("Couldn't turn notifications on. Try again in a moment.")
      } else {
        setNotice('Notifications are on. We will message this device when there is news.')
      }
    } catch {
      setError("Couldn't turn notifications on. Try again in a moment.")
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  async function turnOff() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await supabase.rpc('remove_push_subscription', { p_endpoint: subscription.endpoint })
        await subscription.unsubscribe()
      }
      setNotice('Notifications are off for this device.')
    } catch {
      setError("Couldn't turn notifications off. Try again in a moment.")
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  async function sendTest() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ title: 'EventCheckin', body: 'Notifications are working on this device.' }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Could not send the test notification.')
      else setNotice(json.sent > 0 ? 'Test notification sent.' : 'No devices to send to yet.')
    } catch {
      setError('Could not send the test notification.')
    } finally {
      setBusy(false)
    }
  }

  const cardStyle = { padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', flexDirection: 'column' as const, gap: '12px' }

  return (
    <section aria-labelledby="push-heading" style={cardStyle}>
      <h2 id="push-heading" style={{ fontSize: '18px', fontWeight: 600 }}>Notifications</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
        {state === 'checking' ? 'Checking this device...' : STATUS_TEXT[state]}
      </p>

      {state === 'ios-install' && (
        <ol style={{ fontSize: '14px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li>Tap the Share button in Safari (the square with an arrow).</li>
          <li>Choose <strong>Add to Home Screen</strong>, then tap Add.</li>
          <li>Open EventCheckin from your Home Screen and come back to this page.</li>
        </ol>
      )}

      {error && <div className="alert-error" role="alert">{error}</div>}
      {notice && <div className="alert-success" role="status">{notice}</div>}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {state === 'off' && (
          <button type="button" className="btn-primary" onClick={turnOn} disabled={busy}>
            {busy ? 'Turning on...' : 'Turn on notifications'}
          </button>
        )}
        {state === 'on' && (
          <>
            <button type="button" className="btn-secondary" onClick={turnOff} disabled={busy}>
              Turn off on this device
            </button>
            {mode === 'organizer' && (
              <button type="button" className="btn-secondary" onClick={sendTest} disabled={busy}>
                Send a test notification
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
