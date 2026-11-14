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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Download,
  Users,
  Calendar,
  MapPin,
  Clock,
  Radio,
  ShieldCheck,
  Printer,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Share2,
  FileText,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

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

function formatStartTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function EventDetailPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [hubTab, setHubTab] = useState<'qr' | 'registration'>('qr')
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
    } catch {
      setError('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800)
    })
  }

  // Active registration counts & KPIs
  const stats = useMemo(() => {
    const active = registrations.filter((r) => !['cancelled', 'rejected'].includes(r.registration_status))
    return {
      registered: active.length,
      pending: registrations.filter((r) => r.registration_status === 'pending').length,
      checkedIn: active.filter((r) => r.checkins && r.checkins.length > 0).length,
      collected: active.filter((r) => !!r.badge_collected_at).length,
      readyToCollect: active.filter((r) => r.checkins && r.checkins.length > 0 && !r.badge_collected_at).length,
    }
  }, [registrations])

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="grid gap-4">
        <Alert variant="error">{error || 'Event not found'}</Alert>
        <Button className="w-fit" render={<Link href="/events" />} nativeButton={false}>
          Back to events
        </Button>
      </div>
    )
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '')
  const checkInUrl = `${appUrl}/checkin/${event.event_id}`
  const bannerUrl = publicImageUrl('branding', event.banner_path)
  const logoUrl = publicImageUrl('branding', event.logo_path ?? event.organizations?.logo_path)
  const place = event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location
  const date = new Date(event.event_date + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Readiness Checklist
  const readiness = [
    { label: 'Venue confirmed', done: !!event.venue_type && event.venue_type !== 'tba', href: `/events/${event.id}/edit` },
    { label: 'Start time set', done: !!event.start_time, href: `/events/${event.id}/edit` },
    { label: 'Guests added', done: stats.registered > 0, href: `/events/${event.id}/guests` },
    { label: 'Registration open', done: event.registration_open, href: `/events/${event.id}` },
  ]
  const readinessDoneCount = readiness.filter((r) => r.done).length

  // Calculated Progress Percentages
  const capacityPercent = event.capacity
    ? Math.min(100, Math.round((stats.registered / event.capacity) * 100))
    : null
  const attendancePercent = stats.registered
    ? Math.round((stats.checkedIn / stats.registered) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 1. Hero Cover Banner */}
      {bannerUrl && (
        <div className="relative overflow-hidden rounded-3xl border border-border bg-muted shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            className="aspect-[4/1] max-h-[220px] w-full object-cover"
          />
        </div>
      )}

      {/* 2. Hero Header & Quick Action Launchpad */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-5">
          {/* Left: Event Identity & Meta */}
          <div className="flex min-w-0 items-start gap-4.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="size-16 shrink-0 rounded-2xl border border-border bg-white object-contain p-2 shadow-xs"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-xl">
                {event.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
                  {event.name}
                </h1>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold capitalize shadow-2xs',
                    event.status === 'live'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : event.status === 'closed'
                      ? 'bg-destructive/10 text-destructive border border-destructive/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  )}
                >
                  {event.status === 'live' && (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  {event.status}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin size={14} className="opacity-70 text-primary" />
                  {place}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar size={14} className="opacity-70 text-primary" />
                  {date}
                  {event.start_time && ` at ${formatStartTime(event.start_time)}`}
                </span>
              </div>

              {/* Event ID Badge with 1-Click Copy */}
              <div className="mt-3.5 flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-1 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Event ID:
                  </span>
                  <code className="font-mono font-bold text-foreground">
                    {event.event_id}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(event.event_id, 'eventId')}
                    className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copy Event ID"
                  >
                    {copiedKey === 'eventId' ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Primary Operational Launchpad */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              className="rounded-full shadow-xs gap-1.5 bg-primary text-primary-foreground font-semibold px-4.5"
              render={<Link href={`/events/${event.id}/desk`} />}
              nativeButton={false}
            >
              <Radio size={14} />
              <span>⚡ Live Gate Station</span>
            </Button>

            <Button
              variant="outline"
              className="rounded-full shadow-xs gap-1.5"
              render={<a href={checkInUrl} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
              title="Open Attendee Self Check-in Stand"
            >
              <span>Self Check-in</span>
              <ExternalLink size={12} className="opacity-60" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-full size-9 p-0 text-muted-foreground hover:text-foreground"
              render={<Link href={`/events/${event.id}/edit`} />}
              nativeButton={false}
              title="Edit Event Details"
            >
              <Edit3 size={15} />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Realtime Attendance & Capacity Gauge (Bento Grid Row 1) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Card 1: Registered & Capacity */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registered
            </p>
            <Users size={15} className="text-muted-foreground/60" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {stats.registered}
            </span>
            {event.capacity > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                / {event.capacity} capacity
              </span>
            )}
          </div>
          {/* Capacity Progress Bar */}
          {capacityPercent !== null ? (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mb-1">
                <span>{capacityPercent}% filled</span>
                <span>
                  {Math.max(0, event.capacity - stats.registered)} spots left
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    capacityPercent >= 100
                      ? 'bg-rose-500'
                      : capacityPercent >= 80
                      ? 'bg-amber-500'
                      : 'bg-primary'
                  )}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Unlimited capacity</p>
          )}
        </div>

        {/* Card 2: Checked In & Velocity */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Checked In
            </p>
            <Radio size={15} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.checkedIn}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              arrived
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mb-1">
              <span>{attendancePercent}% attendance</span>
              <span>{Math.max(0, stats.registered - stats.checkedIn)} pending</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${attendancePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Badges Handed Out */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Badges
            </p>
            <Printer size={15} className="text-muted-foreground/60" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {stats.collected}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              handed out
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {stats.readyToCollect > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {stats.readyToCollect} ready for printing at desk
              </span>
            ) : (
              'All badges printed & claimed'
            )}
          </p>
        </div>

        {/* Card 4: Approval Status Queue */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Approvals
            </p>
            <ShieldCheck size={15} className="text-muted-foreground/60" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                'text-3xl font-black',
                stats.pending > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'
              )}
            >
              {stats.pending}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              pending
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {event.approval_mode === 'manual' ? 'Manual review on' : 'Auto-approval'}
            </span>
            {stats.pending > 0 && (
              <Link
                href={`/events/${event.id}/guests`}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Review →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 4. Context-Aware Lifecycle Intelligence Bar */}
      {event.status === 'live' ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Check-in is currently live
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.checkedIn} of {stats.registered} registered guests have checked in at the gate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
              render={<Link href={`/events/${event.id}/desk`} />}
              nativeButton={false}
            >
              <Radio size={13} />
              <span>Open Gate Station →</span>
            </Button>
          </div>
        </div>
      ) : event.status === 'closed' ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock size={18} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                This event is closed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check-in is complete. Total attendees: {stats.checkedIn} arrived ({Math.max(0, stats.registered - stats.checkedIn)} no-shows).
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            render={<Link href={`/events/${event.id}/report`} />}
            nativeButton={false}
          >
            <FileText size={13} className="mr-1.5" />
            <span>View Attendance Report</span>
          </Button>
        </div>
      ) : (
        /* Upcoming Event Setup Readiness Bar */
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {readinessDoneCount === 4 ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : (
                <AlertTriangle size={18} className="text-amber-500" />
              )}
              <div>
                <p className="text-xs font-bold text-foreground">
                  Launch Readiness: {readinessDoneCount} of 4 steps complete
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {readinessDoneCount === 4
                    ? 'All pre-flight setup tasks are verified. Ready for event day!'
                    : 'Complete pending setup tasks before opening guest check-in.'}
                </p>
              </div>
            </div>

            {/* Checklist Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {readiness.map((r) => (
                <Link
                  key={r.label}
                  href={r.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    r.done
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  )}
                >
                  <span>{r.done ? '✓' : '○'}</span>
                  <span>{r.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Venue & Schedule Details Strip */}
      <EventDetailsStrip event={event} />

      {/* 6. Unified Share, Invite & Entrance Hub (Bento Row 3) */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-6">
        {/* Hub Segmented Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Attendee Access & Registration Hub
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Print entrance QR passes, manage self-registration, and generate team attribution links
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setHubTab('qr')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                hubTab === 'qr'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <QrCode size={13} />
              <span>Entrance QR & Posters</span>
            </button>
            <button
              type="button"
              onClick={() => setHubTab('registration')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                hubTab === 'registration'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Share2 size={13} />
              <span>Public Registration & Team Links</span>
            </button>
          </div>
        </div>

        {/* TAB 1: VENUE ENTRANCE QR PASS & POSTER */}
        {hubTab === 'qr' && (
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] items-center">
            {/* QR Visual */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-white p-4 shadow-xs">
              <QRCodeSVG
                value={checkInUrl}
                size={170}
                marginSize={1}
                aria-label="Check-in QR code"
              />
              <span className="mt-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Scan to Check In
              </span>
            </div>

            {/* Explanatory & Action Buttons */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Venue Entrance Door Poster
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                  Attendees scan this at your venue gate using their smartphone camera to check in with their phone number or email. You can also display this QR on a check-in tablet.
                </p>
              </div>

              {/* Clean URL Badge */}
              <div className="flex items-center gap-2 max-w-lg">
                <code className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground truncate">
                  {checkInUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(checkInUrl, 'checkinLink')}
                  className="rounded-xl text-xs"
                >
                  {copiedKey === 'checkinLink' ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  onClick={() => downloadQrPdf(checkInUrl, event.name, `${event.event_id}-check-in`)}
                  className="rounded-full bg-primary text-primary-foreground font-semibold text-xs gap-1.5 shadow-xs"
                >
                  <Download size={13} />
                  <span>Download Door Poster (PDF)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => downloadQrPng(checkInUrl, `${event.event_id}-check-in`)}
                  className="rounded-full text-xs gap-1.5"
                >
                  <Download size={13} />
                  <span>Download PNG Image</span>
                </Button>

                <Button
                  variant="outline"
                  render={<a href={checkInUrl} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                  className="rounded-full text-xs gap-1.5"
                >
                  <span>Open Check-in Stand</span>
                  <ExternalLink size={12} className="opacity-70" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PUBLIC REGISTRATION & TEAM REFERRAL ATTRIBUTION */}
        {hubTab === 'registration' && (
          <div>
            <RegistrationSettings
              eventUuid={event.id}
              organizationId={event.organization_id}
              registrations={registrations}
            />
          </div>
        )}
      </div>
    </div>
  )
}
