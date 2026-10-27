'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import EventTabs from '@/components/EventTabs'
import RegistrationSettings from '@/components/RegistrationSettings'
import { publicImageUrl } from '@/lib/storage'
import { countryName } from '@/lib/countries'

interface Event {
  id: string
  event_id: string
  name: string
  location: string
  country: string | null
  city: string | null
  event_date: string
  capacity: number
  status: string
  banner_path: string | null
  logo_path: string | null
  organization_id: string
  organizations: { logo_path: string | null } | null
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
        .select('*, organizations(logo_path)')
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
  const bannerUrl = publicImageUrl('branding', event.banner_path)
  // Event logo, falling back to the organization's logo
  const logoUrl = publicImageUrl('branding', event.logo_path ?? event.organizations?.logo_path)
  const place = event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location

  return (
    <div style={{ maxWidth: '900px' }}>
      <EventTabs eventUuid={event.id} />

      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" style={{ width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--color-border)' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', backgroundColor: '#ffffff', padding: '4px', border: '1px solid var(--color-border)' }} />
          )}
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
              {event.name}
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
              {place} • {new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'capitalize',
            backgroundColor: event.status === 'live' ? 'var(--color-live-soft)' : 'var(--color-neutral-light)',
            color: event.status === 'live' ? 'var(--color-live)' : 'var(--color-text-secondary)',
          }}>
            {event.status}
          </span>
          {event.status === 'live' ? (
            <a href={checkInUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ width: 'auto' }}>
              Open check-in
            </a>
          ) : (
            <Link href={`/events/${event.id}/guests`} className="btn-primary" style={{ width: 'auto' }}>
              Add guests
            </Link>
          )}
        </div>
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

      <RegistrationSettings eventUuid={event.id} organizationId={event.organization_id} />

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
        <Link href={`/events/${event.id}/badge-design`} className="btn-primary">
          Badge Design
        </Link>
        <Link href={`/events/${event.id}/badges`} className="btn-primary">
          Badge Printing
        </Link>
        <Link href={`/events/${event.id}/edit`} className="btn-secondary">
          Edit Event
        </Link>
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
