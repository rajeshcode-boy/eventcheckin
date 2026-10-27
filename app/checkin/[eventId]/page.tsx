'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { isValidEmail } from '@/lib/guests'
import { formatTime } from '@/lib/time'
import { publicImageUrl } from '@/lib/images'
import { countryName } from '@/lib/countries'
import DigitalBadge from '@/components/DigitalBadge'

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
        <div className="alert-error" style={{ fontSize: '18px' }}>
          {eventError === 'Event not found' ? 'This check-in link is not valid. Ask the event staff for help.' : eventError}
        </div>
      </Shell>
    )
  }

  if (!event) {
    return (
      <Shell>
        <p style={{ fontSize: '18px', textAlign: 'center' }}>Loading...</p>
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
        <img src={bannerUrl} alt="" style={{ width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
      )}
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" style={{ height: '64px', maxWidth: '200px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
        )}
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{event.name}</h1>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
          {event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location} • {new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </header>

      {event.status === 'closed' && (
        <div className="alert-warning" role="status" style={{ padding: '24px' }}>
          <p style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Check-in is closed</p>
          <p style={{ fontSize: '16px' }}>Please see the event staff for help.</p>
        </div>
      )}

      {event.status !== 'closed' && view === 'form' && (
        <form onSubmit={handleCheckin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label htmlFor="checkin-query" style={{ fontSize: '18px', fontWeight: 600 }}>
            Check in
          </label>
          <input
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
            className="input-field"
            style={{ fontSize: '18px', minHeight: '52px' }}
          />
          <button type="submit" className="btn-primary" disabled={busy || !query.trim()} style={{ fontSize: '18px', minHeight: '52px', width: '100%' }}>
            {busy ? 'Checking...' : 'Check In'}
          </button>
          {error && <div className="alert-error" style={{ fontSize: '16px' }}>{error}</div>}
        </form>
      )}

      {view === 'result' && result && <ResultCard result={result} onWalkin={() => { setView('walkin'); setError('') }} onDone={reset} />}

      {view === 'walkin' && (
        <form onSubmit={handleWalkin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Register as walk-in</h2>
          {([
            ['firstName', 'First name', true, 'given-name'],
            ['lastName', 'Last name', false, 'family-name'],
            ['designation', 'Designation', true, 'organization-title'],
            ['company', 'Company', true, 'organization'],
            ['email', 'Company email', false, 'email'],
          ] as const).map(([key, label, required, autoComplete]) => (
            <div key={key}>
              <label htmlFor={`walkin-${key}`} style={{ display: 'block', marginBottom: '8px', fontSize: '18px', fontWeight: 500 }}>
                {label}{required ? ' *' : ''}
              </label>
              <input
                id={`walkin-${key}`}
                type={key === 'email' ? 'email' : 'text'}
                value={walkin[key]}
                onChange={(e) => setWalkin({ ...walkin, [key]: e.target.value })}
                className="input-field"
                style={{ fontSize: '18px' }}
                required={required}
                autoComplete={autoComplete}
                maxLength={120}
              />
            </div>
          ))}
          {error && <div className="alert-error" style={{ fontSize: '16px' }}>{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy} style={{ fontSize: '18px', minHeight: '52px', width: '100%' }}>
            {busy ? 'Registering...' : 'Register & Check In'}
          </button>
          <button type="button" className="btn-secondary" onClick={reset} disabled={busy} style={{ fontSize: '18px', width: '100%' }}>
            Back
          </button>
        </form>
      )}
    </Shell>
  )
}

function ResultCard({ result, onWalkin, onDone }: { result: CheckinResult; onWalkin: () => void; onDone: () => void }) {
  if (result.status === 'checked_in' || result.status === 'already_checked_in') {
    const checkedIn = result.status === 'checked_in'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div role="status" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '20px', fontWeight: 600 }}>{checkedIn ? 'Welcome' : 'Already checked in'}</p>
          <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {checkedIn ? 'Checked in' : 'First check-in'} at {formatTime(result.checked_in_at)}
          </p>
        </div>
        {result.badge_token ? (
          <DigitalBadge token={result.badge_token} />
        ) : (
          <div className="alert-warning" role="status" style={{ padding: '24px' }}>
            <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{result.full_name}</p>
          </div>
        )}
        <button className="btn-primary" onClick={onDone} style={{ fontSize: '18px', minHeight: '52px', width: '100%' }}>
          Done
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="alert-error" role="alert" style={{ padding: '24px' }}>
        <p style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>❌ Registration details not found</p>
        <p style={{ fontSize: '16px' }}>Check the spelling, try your other email or phone, or register as a walk-in.</p>
      </div>
      <button className="btn-primary" onClick={onWalkin} style={{ fontSize: '18px', minHeight: '52px', width: '100%' }}>
        Register as walk-in
      </button>
      <button className="btn-secondary" onClick={onDone} style={{ fontSize: '18px', width: '100%' }}>
        Try again
      </button>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>{children}</div>
    </main>
  )
}
