'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import RegistrationSettings, { RegistrationRow } from '@/components/RegistrationSettings'
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
  registration_open: boolean
  approval_mode: 'auto' | 'manual'
  registration_capacity: number | null
  organizations: { logo_path: string | null } | null
}

export default function EventDetailPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const params = useParams()
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
      const { data: regs } = await supabase
        .from('registrations')
        .select('registration_status, referral_member_id, badge_collected_at, checkins(checked_in_at)')
        .eq('event_id', eventId)
      setRegistrations((regs ?? []) as unknown as RegistrationRow[])
    } catch (err) {
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  // Counts for the summary and the sidebar. Cancelled and rejected registrations don't count.
  const stats = useMemo(() => {
    const active = registrations.filter((r) => !['cancelled', 'rejected'].includes(r.registration_status))
    return {
      registered: active.length,
      pending: registrations.filter((r) => r.registration_status === 'pending').length,
      checkedIn: active.filter((r) => r.checkins.length > 0).length,
      collected: active.filter((r) => r.badge_collected_at).length,
      readyToCollect: active.filter((r) => r.checkins.length > 0 && !r.badge_collected_at).length,
    }
  }, [registrations])

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
  const date = new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })

  // One line that says what to do next, based on the event's state
  const nextStep = (() => {
    if (event.status === 'closed') return 'This event is closed. Guests can no longer check in.'
    if (stats.pending > 0) return `${stats.pending} registration${stats.pending === 1 ? ' is' : 's are'} waiting for approval. Review them in Guests.`
    if (event.status === 'live') return `Check-in is live. ${stats.checkedIn} of ${stats.registered} guests checked in so far.`
    if (!event.registration_open && stats.registered === 0) return 'Registration is closed. Open it in the Registration card to start taking sign-ups.'
    if (event.registration_open) return 'Registration is open. Share the general link or a team link.'
    return 'Add guests or open registration to get started.'
  })()

  return (
    <div>
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" style={{ width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--color-border)' }} />
        )}

        <header className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0 }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '10px', backgroundColor: '#ffffff', padding: '4px', border: '1px solid var(--color-border)', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.name}</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '2px' }}>{place} · {date}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '13px',
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
        </header>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '18px' }}>
          <span className="card" style={{ padding: '8px 12px' }}>
            Event ID <code style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--color-text-primary)', fontWeight: 600, marginLeft: '4px' }}>{event.event_id}</code>
          </span>
          <span className="card" style={{ padding: '8px 12px' }}>
            Capacity <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginLeft: '4px' }}>{event.capacity}</span>
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          {[
            { label: 'Registered', value: `${stats.registered}`, sub: event.registration_capacity ? `of ${event.registration_capacity}` : 'no limit' },
            { label: 'Pending approval', value: `${stats.pending}`, sub: event.approval_mode === 'manual' ? 'approval on' : 'auto-approve' },
            { label: 'Checked in', value: `${stats.checkedIn}`, sub: 'at the entrance' },
            { label: 'Badges collected', value: `${stats.collected}`, sub: `${stats.readyToCollect} ready at the desk` },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{s.label}</p>
              <p style={{ fontSize: '22px', fontWeight: 600, marginTop: '4px' }}>{s.value}</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        <div role="status" className="card" style={{ padding: '12px 16px', borderLeft: '4px solid var(--color-primary)', marginBottom: '14px', fontSize: '14px' }}>
          <span style={{ fontWeight: 600 }}>Next step: </span>{nextStep}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', alignItems: 'start' }}>
          <section className="card" style={{ padding: '20px' }} aria-labelledby="checkin-heading">
            <h2 id="checkin-heading" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Check-in</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Guests scan this at the entrance and enter their email or phone.
            </p>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ padding: '12px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <QRCodeSVG value={checkInUrl} size={150} marginSize={1} aria-label="Check-in QR code" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigator.clipboard.writeText(checkInUrl).then(() => setCopied(true))}
                >
                  {copied ? 'Copied' : 'Copy check-in link'}
                </button>
                <a href={checkInUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  Open check-in page
                </a>
              </div>
            </div>
            <code style={{ display: 'block', marginTop: '14px', fontSize: '12px', wordBreak: 'break-all', color: 'var(--color-text-secondary)' }}>{checkInUrl}</code>
          </section>

          <RegistrationSettings eventUuid={event.id} organizationId={event.organization_id} registrations={registrations} />
        </div>
    </div>
  )
}
