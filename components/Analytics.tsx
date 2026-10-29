'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PostHog } from 'posthog-js'
import { Button } from '@/components/ui/button'
import {
  CONSENT_EVENT,
  isTrackedPath,
  loadPostHog,
  loadedPostHog,
  pendingOrganiserId,
  readConsent,
  writeConsent,
  type Consent,
} from '@/lib/analytics'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

function startPostHog(posthog: PostHog, key: string) {
  posthog.init(key, {
    api_host: HOST,
    person_profiles: 'identified_only',
    // Page views are sent by hand below, so guest pages can be skipped
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    // Clicks are recorded without the text or attributes of what was clicked
    mask_all_text: true,
    mask_all_element_attributes: true,
    session_recording: { maskAllInputs: true, maskTextSelector: '*' },
    before_send: (event) => (event && isTrackedPath(window.location.pathname) ? event : null),
  })
  const id = pendingOrganiserId()
  if (id) posthog.identify(id)
}

// Loads PostHog only after the visitor accepts, and only on tracked pages.
// Does nothing at all until NEXT_PUBLIC_POSTHOG_KEY is set.
export default function Analytics() {
  const pathname = usePathname()
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined)

  useEffect(() => {
    setConsent(readConsent())
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent | null>).detail)
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  const tracked = isTrackedPath(pathname)

  useEffect(() => {
    if (!KEY) return
    const key = KEY
    let cancelled = false

    if (consent === 'denied') {
      const posthog = loadedPostHog()
      posthog?.stopSessionRecording()
      posthog?.opt_out_capturing()
      return
    }
    if (consent !== 'granted' || (!tracked && !loadedPostHog())) return

    loadPostHog().then((posthog) => {
      if (cancelled) return
      if (!posthog.__loaded) startPostHog(posthog, key)
      else if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing()
      if (tracked) {
        posthog.capture('$pageview')
        posthog.startSessionRecording()
      } else {
        posthog.stopSessionRecording()
      }
    })
    return () => {
      cancelled = true
    }
  }, [consent, pathname, tracked])

  if (!KEY || consent !== null || !tracked) return null

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-border bg-card p-5 shadow-xl sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
    >
      <p className="font-semibold">Help us improve EventCheckin</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        With your permission we use cookies to see which pages and buttons people use. Text on the page, anything you type and
        guest details are never recorded.{' '}
        <Link href="/privacy" className="font-semibold text-primary underline-offset-4 hover:underline dark:text-brand">
          Privacy Policy
        </Link>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => writeConsent('denied')}>
          Decline
        </Button>
        <Button onClick={() => writeConsent('granted')}>Accept</Button>
      </div>
    </div>
  )
}

// Lets a visitor reopen the consent choice, e.g. from the footer
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!KEY) return null
  return (
    <button type="button" className={className} onClick={() => writeConsent(null)}>
      Cookie settings
    </button>
  )
}
