'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { isValidEmail } from '@/lib/guests'
import { formatTime } from '@/lib/time'
import { publicImageUrl } from '@/lib/images'
import { countryName } from '@/lib/countries'
import DigitalBadge from '@/components/DigitalBadge'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EventInfo {
  name: string
  location: string
  event_date: string
  status: 'upcoming' | 'live' | 'closed'
  country: string | null
  city: string | null
  banner_path: string | null
  logo_path: string | null
  org_logo_path: string | null
}

interface CheckinResult {
  status: 'checked_in' | 'already_checked_in' | 'not_found' | 'event_not_found' | 'already_registered' | 'invalid' | 'closed'
  registration_id: string | null
  full_name: string | null
  designation: string | null
  company: string | null
  checked_in_at: string | null
  badge_token: string | null
}

type View = 'form' | 'walkin' | 'result'

const EMPTY_WALKIN = { firstName: '', lastName: '', designation: '', company: '', email: '' }


async function callApi(body: object): Promise<CheckinResult> {
  let res: Response
  try {
    res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No connection. Check the internet and try again.')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.result) throw new Error(json.error || 'Something went wrong. Please try again.')
  return json.result
}

export default function PublicCheckinPage() {
  const params = useParams()
  const eventId = decodeURIComponent(params.eventId as string)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [eventError, setEventError] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('form')
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [walkin, setWalkin] = useState(EMPTY_WALKIN)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/checkin?eventId=${encodeURIComponent(eventId)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (res.ok && json.event) setEvent(json.event)
        else setEventError(json.error || 'Event not found')
      })
      .catch(() => setEventError('No connection. Check the internet and reload.'))
  }, [eventId])

  // Back to the search box for the next guest. Only the guest's own "Done" does this; the badge never clears itself.
  const reset = () => {
    setView('form')
    setResult(null)
    setQuery('')
    setWalkin(EMPTY_WALKIN)
    setError('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const showResult = (r: CheckinResult) => {
    setResult(r)
    setView('result')
  }

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setError('')
    setBusy(true)
    try {
      const r = await callApi({ eventId, query })
      if (r.status === 'closed') markClosed()
      else showResult(r)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Organizer closed check-in while this page was open
  const markClosed = () => {
    setEvent((ev) => (ev ? { ...ev, status: 'closed' } : ev))
    setView('form')
    setError('')
  }

  const handleWalkin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (walkin.email && !isValidEmail(walkin.email.trim())) {
      setError('Email format looks wrong')
      return
    }
    setBusy(true)
    try {
      const r = await callApi({ eventId, walkin })
      if (r.status === 'closed') {
        markClosed()
      } else if (r.status === 'already_registered') {
        setError('This email is already registered. Go back and check in with it.')
      } else if (r.status === 'invalid') {
        setError('Please fill in first name, designation and company.')
      } else {
        showResult(r)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (eventError) {
    return (
      <Shell>
        <Alert variant="error" className="text-lg">
          {eventError === 'Event not found' ? 'This check-in link is not valid. Ask the event staff for help.' : eventError}
        </Alert>
      </Shell>
    )
  }

  if (!event) {
    return (
      <Shell>
        <p className="text-center text-lg">Loading...</p>
      </Shell>
    )
  }

  const bannerUrl = publicImageUrl('branding', event.banner_path)
  // Event logo, falling back to the organizer's company logo
  const logoUrl = publicImageUrl('branding', event.logo_path ?? event.org_logo_path)

  return (
    <Shell>
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className="mb-4 aspect-[4/1] w-full rounded-lg object-cover" />
      )}
      <header className="mb-8 text-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mx-auto mb-3 block h-16 max-w-[200px] object-contain" />
        )}
        <h1 className="mb-2 text-[28px] font-bold">{event.name}</h1>
        <p className="text-base text-muted-foreground">
          {event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location} • {new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </header>

      {event.status === 'closed' && (
        <Alert variant="warning" className="p-6">
          <p className="mb-2 text-xl font-semibold">Check-in is closed</p>
          <p className="text-base">Please see the event staff for help.</p>
        </Alert>
      )}

      {event.status !== 'closed' && view === 'form' && (
        <form onSubmit={handleCheckin} className="flex flex-col gap-4">
          <label htmlFor="checkin-query" className="text-lg font-semibold">
            Check in
          </label>
          <Input
            id="checkin-query"
            ref={inputRef}
            type="text"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter email or phone"
            className={`${field} md:text-lg`}
          />
          <Button type="submit" className={bigButton} disabled={busy || !query.trim()}>
            {busy ? 'Checking...' : 'Check In'}
          </Button>
          {error && <Alert variant="error" className="text-base">{error}</Alert>}
        </form>
      )}

      {view === 'result' && result && <ResultCard result={result} onWalkin={() => { setView('walkin'); setError('') }} onDone={reset} />}

      {view === 'walkin' && (
        <form onSubmit={handleWalkin} className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Register as walk-in</h2>
          {([
            ['firstName', 'First name', true, 'given-name'],
            ['lastName', 'Last name', false, 'family-name'],
            ['designation', 'Designation', true, 'organization-title'],
            ['company', 'Company', true, 'organization'],
            ['email', 'Company email', false, 'email'],
          ] as const).map(([key, label, required, autoComplete]) => (
            <div key={key}>
              <label htmlFor={`walkin-${key}`} className="mb-2 block text-lg font-medium">
                {label}{required ? ' *' : ''}
              </label>
              <Input
                id={`walkin-${key}`}
                type={key === 'email' ? 'email' : 'text'}
                value={walkin[key]}
                onChange={(e) => setWalkin({ ...walkin, [key]: e.target.value })}
                className={`${field} md:text-lg`}
                required={required}
                autoComplete={autoComplete}
                maxLength={120}
              />
            </div>
          ))}
          {error && <Alert variant="error" className="text-base">{error}</Alert>}
          <Button type="submit" className={bigButton} disabled={busy}>
            {busy ? 'Registering...' : 'Register & Check In'}
          </Button>
          <Button type="button" variant="outline" className={bigButton} onClick={reset} disabled={busy}>
            Back
          </Button>
        </form>
      )}
    </Shell>
  )
}

function ResultCard({ result, onWalkin, onDone }: { result: CheckinResult; onWalkin: () => void; onDone: () => void }) {
  if (result.status === 'checked_in' || result.status === 'already_checked_in') {
    const checkedIn = result.status === 'checked_in'
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="text-center">
          <p className="text-xl font-semibold">{checkedIn ? 'Welcome' : 'Already checked in'}</p>
          <p className="mt-1 text-base text-muted-foreground">
            {checkedIn ? 'Checked in' : 'First check-in'} at {formatTime(result.checked_in_at)}
          </p>
        </div>
        {result.badge_token ? (
          <DigitalBadge token={result.badge_token} />
        ) : (
          <Alert variant="warning" className="p-6">
            <p className="text-lg font-bold">{result.full_name}</p>
          </Alert>
        )}
        <Button className={bigButton} onClick={onDone}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="error" className="p-6">
        <p className="mb-2 text-xl font-semibold">❌ Registration details not found</p>
        <p className="text-base">Check the spelling, try your other email or phone, or register as a walk-in.</p>
      </Alert>
      <Button className={bigButton} onClick={onWalkin}>
        Register as walk-in
      </Button>
      <Button variant="outline" className={bigButton} onClick={onDone}>
        Try again
      </Button>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen justify-center px-4 py-8">
      <div className="w-full max-w-[440px]">{children}</div>
    </main>
  )
}

// Guests use their own phones, so inputs and buttons are large
const field = 'h-[52px] text-lg'
const bigButton = 'h-[52px] w-full text-lg'
