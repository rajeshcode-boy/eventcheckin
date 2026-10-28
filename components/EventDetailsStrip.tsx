'use client'

import { useEffect, useState } from 'react'
import { countryName } from '@/lib/countries'
import type { PublicHoliday } from '@/lib/holidays'
import { zoneShortName } from '@/lib/timezones'

export interface EventDetailsInput {
  location: string
  country: string | null
  city: string | null
  event_date: string
  start_time: string | null
  timezone: string | null
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

  const place = event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location
  const date = new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = formatStartTime(event.start_time)
  // Start time in the venue's own zone, e.g. "6:30 PM AST"
  const zoneLabel = event.timezone && event.start_time ? zoneShortName(event.timezone, event.event_date) : ''

  useEffect(() => {
    if (!event.country) return
    const today = new Date().toISOString().slice(0, 10)
    let active = true
    fetch(`/api/holidays?country=${event.country}&from=${today}`)
      .then((r) => (r.ok ? r.json() : { holidays: [] }))
      .then((data: { holidays: PublicHoliday[] }) => {
        if (active) setHolidays(data.holidays)
      })
      .catch(() => {
        // Holidays are optional; leave the list empty
      })
    return () => {
      active = false
    }
  }, [event.country])

  const chipStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '999px',
    backgroundColor: 'var(--color-neutral-light)',
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
  }

  if (compact) {
    const next = holidays[0]
    return (
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px', overflowWrap: 'anywhere' }}>
        {place} · {date}
        {time && ` · ${time}`}
        {next && (
          <span style={{ marginLeft: '8px', ...chipStyle, display: 'inline-block' }}>
            Holiday: {next.name} ({formatHolidayDate(next.date)})
          </span>
        )}
      </p>
    )
  }

  return (
    <section className="card" aria-label="Event details" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '14px 24px', alignItems: 'center', marginBottom: '14px' }}>
      <div>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Venue</p>
        <p style={{ fontSize: '15px', fontWeight: 600 }}>{place}</p>
      </div>
      <div>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date and time</p>
        <p style={{ fontSize: '15px', fontWeight: 600 }}>
          {date}
          {time && `, ${time}${zoneLabel ? ` ${zoneLabel}` : ''}`}
        </p>
      </div>
      {holidays.length > 0 && (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Upcoming public holidays</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            {holidays.map((h) => (
              <span key={h.date + h.name} style={chipStyle}>
                {h.name} · {formatHolidayDate(h.date)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
