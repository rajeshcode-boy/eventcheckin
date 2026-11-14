'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Ticket,
  Globe,
  Copy,
  Check,
  Building2,
  Video,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'
import { countryName } from '@/lib/countries'

interface EventPassSimulatorProps {
  name: string
  city: string
  country: string
  eventDate: string
  startTime: string
  venueType: 'in_person' | 'virtual' | 'tba'
  venueName: string
  venueAddress: string
  virtualPlatform: string
  capacity: number | string
  bannerUrl: string | null
  logoUrl: string | null
  eventId: string
}

export default function EventPassSimulator({
  name,
  city,
  country,
  eventDate,
  startTime,
  venueType,
  venueName,
  venueAddress,
  virtualPlatform,
  capacity,
  bannerUrl,
  logoUrl,
  eventId,
}: EventPassSimulatorProps) {
  const [activeTab, setActiveTab] = useState<'pass' | 'portal'>('pass')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!eventId) return
    navigator.clipboard.writeText(eventId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Format date nicely
  const formattedDate = eventDate
    ? new Date(eventDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  // Format location
  const locationText =
    venueType === 'virtual'
      ? virtualPlatform ? `Online via ${virtualPlatform}` : 'Online / Virtual Event'
      : venueType === 'in_person'
      ? venueName
        ? `${venueName}${city ? `, ${city}` : ''}`
        : city
        ? `${city}${country ? `, ${countryName(country)}` : ''}`
        : 'In-Person Venue'
      : 'Venue to be announced'

  const displayTitle = name.trim() || 'Untitled Event'
  const displayId = eventId || 'EVENT-CITY-DATE'
  const checkinUrl = `https://eventcheckin-five.vercel.app/checkin/${eventId || 'preview'}`

  return (
    <div className="sticky top-6 flex flex-col gap-4">
      {/* Simulator Controller Header */}
      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 p-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pass')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'pass'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Ticket size={13} />
            <span>Attendee Pass</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'portal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe size={13} />
            <span>Check-in Portal</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span>Live Simulator</span>
        </div>
      </div>

      {/* Simulator Screen */}
      {activeTab === 'pass' ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 transition-all">
          {/* Top Banner */}
          <div className="relative aspect-[3.8/1] w-full overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt="Event banner"
                className="size-full object-cover"
              />
            ) : (
              <div className="relative flex size-full items-center justify-between p-4 text-white">
                <div className="relative z-10 flex flex-col">
                  <span className="text-[10px] font-bold tracking-wider uppercase opacity-80">
                    Official Event Pass
                  </span>
                  <span className="text-sm font-semibold tracking-tight">
                    {displayTitle}
                  </span>
                </div>
                {/* Subtle geometric pattern overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
              </div>
            )}
          </div>

          {/* Logo & Event Details Header */}
          <div className="relative px-5 pt-3">
            <div className="flex items-start gap-3">
              {/* Event Logo Badge */}
              <div className="-mt-8 relative flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-card bg-white shadow-md dark:bg-neutral-900">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Event logo"
                    className="size-full rounded-lg object-contain p-1"
                  />
                ) : (
                  <Sparkles className="size-6 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="truncate font-bold text-foreground text-base tracking-tight sm:text-lg">
                  {displayTitle}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-primary" />
                    <span>{formattedDate || 'Date to be announced'}</span>
                  </div>
                  {startTime && (
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-primary" />
                      <span>{startTime}</span>
                    </div>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {venueType === 'virtual' ? (
                    <Video size={12} className="text-primary" />
                  ) : (
                    <MapPin size={12} className="text-primary" />
                  )}
                  <span className="truncate">{locationText}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Perforated Ticket Notches & Divider */}
          <div className="relative my-4 flex items-center">
            <div className="-ml-3 size-6 rounded-r-full border-r border-y border-border bg-muted/60" />
            <div className="flex-1 border-t-2 border-dashed border-border/80" />
            <div className="-mr-3 size-6 rounded-l-full border-l border-y border-border bg-muted/60" />
          </div>

          {/* Pass Holder & QR Code Area */}
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                  <ShieldCheck size={11} />
                  <span>VIP ATTENDEE</span>
                </div>
                <p className="truncate text-sm font-bold text-foreground">
                  Alex Morgan
                </p>
                <p className="text-[11px] text-muted-foreground">
                  alex.morgan@company.com
                </p>
                <div className="mt-2 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <span>ID:</span>
                  <span className="font-semibold text-foreground truncate max-w-[140px]">
                    {displayId}
                  </span>
                  {eventId && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="ml-1 inline-flex text-muted-foreground transition hover:text-foreground"
                      title="Copy Event ID"
                    >
                      {copied ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex shrink-0 flex-col items-center">
                <div className="rounded-xl border border-border/80 bg-white p-2 shadow-sm dark:bg-white">
                  <QRCodeSVG
                    value={
                      eventId
                        ? `https://eventcheckin-five.vercel.app/checkin/${eventId}`
                        : 'https://eventcheckin-five.vercel.app'
                    }
                    size={92}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                </div>
                <span className="mt-1 text-[9px] font-medium text-muted-foreground uppercase">
                  Scan at Gate
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Check-in Portal Preview */
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5">
          {/* Simulated Browser Chrome */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500/80" />
              <span className="size-2.5 rounded-full bg-amber-500/80" />
              <span className="size-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex flex-1 items-center justify-center rounded-md bg-background px-3 py-0.5 text-[11px] text-muted-foreground truncate">
              {checkinUrl}
            </div>
          </div>

          {/* Mini Portal Content */}
          <div className="p-4 flex flex-col gap-3">
            <div className="relative aspect-[4/1] w-full overflow-hidden rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700">
              {bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerUrl}
                  alt="Banner"
                  className="size-full object-cover"
                />
              )}
            </div>

            <div className="text-center py-2">
              <h4 className="font-bold text-foreground text-sm">
                {displayTitle}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Self-Service Attendee Check-in Desk
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 flex flex-col gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Enter your registered email or pass code:
              </span>
              <div className="h-8 rounded-md border border-input bg-background px-3 flex items-center text-xs text-muted-foreground">
                alex.morgan@company.com
              </div>
              <div className="h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                Confirm Check-In
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Gate Station Ready
              </span>
              <span>1-tap fast check-in</span>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Helper Card */}
      <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Sparkles className="size-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">
              What you see is what guests get
            </span>
            <p className="leading-relaxed">
              Every detail you enter updates the attendee digital pass, badge printer template, and gate scanner in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
