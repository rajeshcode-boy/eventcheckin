'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { isValidEmail } from '@/lib/guests'

interface EventInfo {
  name: string
  location: string
  event_date: string
}

interface CheckinResult {
  status: 'checked_in' | 'already_checked_in' | 'not_found' | 'event_not_found' | 'already_registered' | 'invalid'
  registration_id: string | null
  full_name: string | null
  company: string | null
  checked_in_at: string | null
}

type View = 'form' | 'walkin' | 'result'

const AUTO_CLEAR_MS = 3000
const EMPTY_WALKIN = { firstName: '', lastName: '', designation: '', company: '', email: '' }

const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''

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
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
  }, [])

  const reset = () => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
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
    if (r.status === 'checked_in') {
      clearTimer.current = setTimeout(reset, AUTO_CLEAR_MS)
    }
  }

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setError('')
    setBusy(true)
    try {
      showResult(await callApi({ eventId, query }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
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
      if (r.status === 'already_registered') {
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

  return (
    <Shell>
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>{event.name}</h1>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
          {event.location} • {new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </header>

      {view === 'form' && (
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
  if (result.status === 'checked_in') {
    return (
      <div className="alert-success" role="status" style={{ padding: '24px' }}>
        <p style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>✅ Welcome!</p>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{result.full_name}</p>
        {result.company && <p style={{ fontSize: '14px', marginTop: '4px' }}>{result.company}</p>}
        <p style={{ fontSize: '16px', marginTop: '12px' }}>Checked in at {formatTime(result.checked_in_at)}</p>
        {result.registration_id && (
          <p style={{ fontSize: '14px', marginTop: '4px', fontFamily: 'monospace' }}>Reg ID: {result.registration_id}</p>
        )}
      </div>
    )
  }

  if (result.status === 'already_checked_in') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="alert-warning" role="status" style={{ padding: '24px' }}>
          <p style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>⚠️ Already checked in</p>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{result.full_name}</p>
          {result.company && <p style={{ fontSize: '14px', marginTop: '4px' }}>{result.company}</p>}
          <p style={{ fontSize: '16px', marginTop: '12px' }}>First check-in: {formatTime(result.checked_in_at)}</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>No second check-in recorded.</p>
        </div>
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
