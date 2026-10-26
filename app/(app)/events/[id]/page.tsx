'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'

interface Event {
  id: string
  event_id: string
  name: string
  location: string
  event_date: string
  capacity: number
  status: string
}

export default function EventDetailPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  useEffect(() => {
    fetchEvent()
  }, [eventId])

  const fetchEvent = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (fetchError || !data) {
        setError('Event not found')
        return
      }

      setEvent(data)
    } catch (err) {
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p>Loading event...</p>
  }

  if (error || !event) {
    return (
      <div>
        <p className="alert-error">{error}</p>
        <Link href="/events" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
          Back to events
        </Link>
      </div>
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  const checkInUrl = `${appUrl}/checkin/${event.event_id}`

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/events" style={{ color: 'var(--color-primary-green)', fontSize: '14px' }}>
          ← Back to events
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
            {event.name}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            {event.location} • {new Date(event.event_date).toLocaleDateString()}
          </p>
        </div>
        <span style={{
          padding: '8px 16px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: '500',
          backgroundColor: event.status === 'live' ? '#d1fae5' : 'var(--color-neutral-light)',
          color: event.status === 'live' ? '#065f46' : 'var(--color-text-secondary)',
        }}>
          {event.status}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '4px' }}>
            Event ID
          </p>
          <p style={{ fontSize: '18px', fontWeight: '600', fontFamily: 'monospace' }}>
            {event.event_id}
          </p>
        </div>
        <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '4px' }}>
            Capacity
          </p>
          <p style={{ fontSize: '18px', fontWeight: '600' }}>
            {event.capacity} guests
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>
          Check-in URL
        </h2>
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--color-neutral-light)',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
          fontFamily: 'monospace',
          fontSize: '14px',
          wordBreak: 'break-all',
          marginBottom: '8px',
        }}>
          {checkInUrl}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <button
            className="btn-secondary"
            onClick={() => navigator.clipboard.writeText(checkInUrl).then(() => setCopied(true))}
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <a href={checkInUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Open check-in page
          </a>
        </div>
        <div style={{ display: 'inline-block', padding: '16px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <QRCodeSVG value={checkInUrl} size={200} marginSize={1} aria-label="Check-in QR code" />
        </div>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          Print or display this QR code at the entrance. Guests scan it and enter their email or phone.
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <Link href={`/events/${event.id}/guests`} className="btn-primary">
          Attendee Registration
        </Link>
        <Link href={`/events/${event.id}/dashboard`} className="btn-primary">
          Live Dashboard
        </Link>
        <button className="btn-primary" disabled>
          Badge Printing (Step 5)
        </button>
      </div>

      <p style={{
        marginTop: '32px',
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderLeft: '4px solid var(--color-amber-warning)',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#78350f',
      }}>
        💡 Add attendees from Attendee Registration: import a CSV or Excel file, or add them one by one.
      </p>
    </div>
  )
}
