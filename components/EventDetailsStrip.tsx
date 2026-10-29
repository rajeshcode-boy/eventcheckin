'use client'

import { useEffect, useState } from 'react'
import { countryName } from '@/lib/countries'
import type { PublicHoliday } from '@/lib/holidays'
import { zoneShortName } from '@/lib/timezones'
import { cn } from '@/lib/utils'

export interface EventDetailsInput {
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
}

// "18:30:00" -> "6:30 PM"
function formatStartTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatHolidayDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })
}

// Venue, date, start time and the next public holidays in the event's country.
// `compact` is the one-line version used on the event list.
export default function EventDetailsStrip({ event, compact = false }: { event: EventDetailsInput; compact?: boolean }) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [covered, setCovered] = useState(true)
  const [listNeedsUpdate, setListNeedsUpdate] = useState(false)

  const place = event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location

  // Venue depends on its type: a hotel and address, a virtual platform and link, or TBA
  const venueSummary: { key: string; text: string; strong?: boolean; href?: string }[] = (() => {
    if (event.venue_type === 'in_person') {
      return [
        { key: 'name', text: event.venue_name || 'Venue name to be added', strong: true },
        ...(event.venue_address ? [{ key: 'address', text: event.venue_address }] : []),
        ...(event.venue_map_url ? [{ key: 'map', text: 'Open in maps', href: event.venue_map_url }] : []),
      ]
    }
    if (event.venue_type === 'virtual') {
      return [
        { key: 'platform', text: event.virtual_platform || 'Online event', strong: true },
        ...(event.virtual_link ? [{ key: 'link', text: 'Join link', href: event.virtual_link }] : []),
      ]
    }
    return [{ key: 'tba', text: 'To be announced', strong: true }]
  })()
  const venueShort = event.venue_type === 'in_person'
    ? event.venue_name || 'Venue TBA'
    : event.venue_type === 'virtual'
      ? 'Online'
      : 'Venue TBA'
  const date = new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = formatStartTime(event.start_time)
  // Start time in the venue's own zone, e.g. "6:30 PM AST"
  const zoneLabel = event.timezone && event.start_time ? zoneShortName(event.timezone, event.event_date) : ''

  useEffect(() => {
    if (!event.country) return
    const today = new Date().toISOString().slice(0, 10)
    let active = true
    fetch(`/api/holidays?country=${event.country}&from=${today}`)
      .then((r) => (r.ok ? r.json() : { holidays: [], covered: false }))
      .then((data: { holidays: PublicHoliday[]; covered: boolean; listNeedsUpdate?: boolean }) => {
        if (!active) return
        setHolidays(data.holidays)
        setCovered(data.covered)
        setListNeedsUpdate(!!data.listNeedsUpdate)
      })
      .catch(() => {
        // Holidays are optional; leave the list empty
      })
    return () => {
      active = false
    }
  }, [event.country])

  const chip = 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-foreground'

  if (compact) {
    const next = holidays[0]
    return (
      <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {place} · {date}
        {time && ` · ${time}`}
        {' · '}{venueShort}
        {next && (
          <span className={`${chip} ml-2 inline-block`}>
            Holiday: {next.name} ({formatHolidayDate(next.date)})
          </span>
        )}
      </p>
    )
  }

  const heading = 'text-xs font-semibold tracking-wide text-muted-foreground uppercase'

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3.5 rounded-xl border border-border bg-card px-4.5 py-3.5" aria-label="Event details">
      <div>
        <p className={heading}>Location</p>
        <p className="text-[15px] font-semibold">{place}</p>
      </div>
      <div className="min-w-0">
        <p className={heading}>Venue</p>
        {venueSummary.map((line) => (
          <p key={line.key} className={cn('text-[15px] [overflow-wrap:anywhere]', line.strong ? 'font-semibold' : 'font-normal')}>
            {line.href ? <a href={line.href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{line.text}</a> : line.text}
          </p>
        ))}
      </div>
      <div>
        <p className={heading}>Date and time</p>
        <p className="text-[15px] font-semibold">
          {date}
          {time && `, ${time}${zoneLabel ? ` ${zoneLabel}` : ''}`}
        </p>
      </div>
      {event.country && (
        <div className="min-w-0">
          <p className={heading}>Upcoming public holidays</p>
          {holidays.length > 0 ? (
            <>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {holidays.map((h) => (
                  <span key={h.date + h.name} className={chip}>
                    {h.name} · {formatHolidayDate(h.date)}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Dates are not official. Confirm with the local authority before you plan around them.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {listNeedsUpdate
                ? 'No more holidays in our list for this year. The list needs updating for the coming year.'
                : covered
                  ? 'No upcoming public holidays found.'
                  : 'Holiday information is not available for this country yet.'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
