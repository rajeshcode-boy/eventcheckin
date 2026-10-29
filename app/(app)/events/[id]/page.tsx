'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import RegistrationSettings, { RegistrationRow } from '@/components/RegistrationSettings'
import { publicImageUrl } from '@/lib/storage'
import { countryName } from '@/lib/countries'
import EventDetailsStrip from '@/components/EventDetailsStrip'
import { downloadQrPng, downloadQrPdf } from '@/lib/qrExport'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Event {
  id: string
  event_id: string
  name: string
  location: string
  country: string | null
  city: string | null
  event_date: string
  start_time: string | null
  timezone: string | null
  venue_type: 'in_person' | 'virtual' | 'tba' | null
  venue_name: string | null
  venue_address: string | null
  venue_map_url: string | null
  virtual_platform: string | null
  virtual_link: string | null
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
      <div className="grid gap-4">
        <Alert variant="error">{error}</Alert>
        <Button className="w-fit" render={<Link href="/events" />} nativeButton={false}>Back to events</Button>
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

  // What the event still needs before the day, from the fields already stored
  const readiness = [
    { label: 'Venue confirmed', done: !!event.venue_type && event.venue_type !== 'tba' },
    { label: 'Start time set', done: !!event.start_time },
    { label: 'Guests added', done: stats.registered > 0 },
    { label: 'Registration open', done: event.registration_open },
  ]

  // One line that says what to do next, based on the event's state
  const nextStep = (() => {
    if (event.status === 'closed') return 'This event is closed. Guests can no longer check in.'
    if (stats.pending > 0) return `${stats.pending} registration${stats.pending === 1 ? ' is' : 's are'} waiting for approval. Review them in Guests.`
    if (event.status === 'live') return `Check-in is live. ${stats.checkedIn} of ${stats.registered} guests checked in so far.`
    if (!event.registration_open && stats.registered === 0) return 'Registration is closed. Open it in the Registration card to start taking sign-ups.'
    if (event.registration_open) return 'Registration is open. Share the general link or a team link.'
    return 'Add guests or open registration to get started.'
  })()

  const card = 'rounded-xl border border-border bg-card'

  return (
    <div className="grid gap-3.5">
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className="aspect-[4/1] w-full rounded-xl border border-border object-cover" />
      )}

      <header className={`${card} flex flex-wrap items-center justify-between gap-4 px-5 py-4.5`}>
        <div className="flex min-w-0 items-center gap-3.5">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-14 shrink-0 rounded-[10px] border border-border bg-white object-contain p-1" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{event.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{place} · {date}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[13px] font-semibold capitalize',
              event.status === 'live' ? 'bg-(--color-live-soft) text-(--color-live)' : 'bg-muted text-muted-foreground'
            )}
          >
            {event.status}
          </span>
          {event.status === 'live' ? (
            <Button render={<a href={checkInUrl} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
              Open check-in
            </Button>
          ) : (
            <Button render={<Link href={`/events/${event.id}/guests`} />} nativeButton={false}>
              Add guests
            </Button>
          )}
        </div>
      </header>

      <EventDetailsStrip event={event} />

      <section className={`${card} px-4.5 py-3.5`} aria-label="Readiness">
        <h3 className="mb-2 text-[15px] font-semibold">
          Readiness: {readiness.filter((r) => r.done).length} of {readiness.length} done
        </h3>
        <ul className="grid gap-1.5 text-sm">
          {readiness.map((r) => (
            <li key={r.label} className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('font-bold', r.done ? 'text-(--color-live)' : 'text-muted-foreground')}>{r.done ? '✓' : '○'}</span>
              <span className={r.done ? 'text-foreground' : 'text-muted-foreground'}>{r.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2 text-[13px] text-muted-foreground">
        <span className={`${card} px-3 py-2`}>
          Event ID <code className="ml-1 font-mono font-semibold text-foreground">{event.event_id}</code>
        </span>
        <span className={`${card} px-3 py-2`}>
          Capacity <span className="ml-1 font-semibold text-foreground">{event.capacity}</span>
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
        {[
          { label: 'Registered', value: `${stats.registered}`, sub: event.registration_capacity ? `of ${event.registration_capacity}` : 'no limit' },
          { label: 'Pending approval', value: `${stats.pending}`, sub: event.approval_mode === 'manual' ? 'approval on' : 'auto-approve' },
          { label: 'Checked in', value: `${stats.checkedIn}`, sub: 'at the entrance' },
          { label: 'Badges collected', value: `${stats.collected}`, sub: `${stats.readyToCollect} ready at the desk` },
        ].map((s) => (
          <div key={s.label} className={`${card} px-4 py-3.5`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-[22px] font-semibold">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      <div role="status" className={`${card} border-l-4 border-l-primary px-4 py-3 text-sm`}>
        <span className="font-semibold">Next step: </span>{nextStep}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-3.5">
        <section className={`${card} p-5`} aria-labelledby="checkin-heading">
          <h2 id="checkin-heading" className="mb-1 text-lg font-semibold">Check-in</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Guests scan this at the entrance and enter their email or phone.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-[10px] border border-border bg-white p-3">
              <QRCodeSVG value={checkInUrl} size={150} marginSize={1} aria-label="Check-in QR code" />
            </div>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(checkInUrl).then(() => setCopied(true))}>
                {copied ? 'Copied' : 'Copy check-in link'}
              </Button>
              <Button variant="outline" render={<a href={checkInUrl} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                Open check-in page
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadQrPng(checkInUrl, `${event.event_id}-check-in`)}>
                Download QR (PNG)
              </Button>
              <Button type="button" variant="outline" onClick={() => downloadQrPdf(checkInUrl, event.name, `${event.event_id}-check-in`)}>
                Download QR (PDF)
              </Button>
            </div>
          </div>
          <code className="mt-3.5 block break-all text-xs text-muted-foreground">{checkInUrl}</code>
        </section>

        <RegistrationSettings eventUuid={event.id} organizationId={event.organization_id} registrations={registrations} />
      </div>
    </div>
  )
}
