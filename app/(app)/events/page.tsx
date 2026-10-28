'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import EventDetailsStrip from '@/components/EventDetailsStrip'

interface Stats {
  registered: number
  checkedIn: number
}

// Days from today to the event date (negative once it has passed)
function daysUntil(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(isoDate + 'T00:00:00')
  return Math.round((event.getTime() - today.getTime()) / 86_400_000)
}

function dayLabel(isoDate: string): string {
  const d = daysUntil(isoDate)
  if (d > 1) return `in ${d} days`
  if (d === 1) return 'tomorrow'
  if (d === 0) return 'today'
  return 'ended'
}

// "in 25 days · 120 of 300 checked in" with a bar showing how many registered guests have arrived
function EventProgressRow({ event, stats }: { event: Event; stats: Stats | undefined }) {
  const pct = stats && stats.registered > 0 ? Math.min(100, Math.round((stats.checkedIn / stats.registered) * 100)) : 0
  return (
    <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{dayLabel(event.event_date)}</span>
      {stats && (
        <>
          <span> · {stats.checkedIn} of {stats.registered} checked in</span>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ marginTop: '6px', height: '6px', borderRadius: '999px', backgroundColor: 'var(--color-neutral-light)', maxWidth: '360px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-live)' }} />
          </div>
        </>
      )}
    </div>
  )
}

interface Event {
  id: string
  event_id: string
  name: string
  location: string
  event_date: string
  registration_open: boolean
  country: string | null
  city: string | null
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
  created_at: string
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'closed', label: 'Closed' },
]

const PAGE_SIZE = 10

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profileData) return

      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', profileData.organization_id)
        .order('event_date', { ascending: false })

      if (fetchError) {
        setError("Couldn't load your events. Refresh the page to try again.")
        return
      }

      setEvents(data || [])

      // Registration and check-in totals per event, for the progress bars
      const ids = (data || []).map((e) => e.id)
      if (ids.length > 0) {
        const [regRes, chkRes] = await Promise.all([
          supabase.from('registrations').select('event_id, registration_status').in('event_id', ids),
          supabase.from('checkins').select('event_id').in('event_id', ids),
        ])
        const next: Record<string, Stats> = {}
        for (const id of ids) next[id] = { registered: 0, checkedIn: 0 }
        for (const r of regRes.data ?? []) {
          if (!['cancelled', 'rejected'].includes(r.registration_status) && next[r.event_id]) next[r.event_id]!.registered += 1
        }
        for (const c of chkRes.data ?? []) if (next[c.event_id]) next[c.event_id]!.checkedIn += 1
        setStats(next)
      }
    } catch (err) {
      setError("Couldn't load your events. Refresh the page to try again.")
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: events.length }
    for (const e of events) result[e.status] = (result[e.status] ?? 0) + 1
    return result
  }, [events])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (!q) return true
      return [e.name, e.location, e.event_id].some((v) => v?.toLowerCase().includes(q))
    })
  }, [events, query, statusFilter])

  const copyId = (eventId: string) => {
    navigator.clipboard.writeText(eventId).then(() => {
      setCopiedId(eventId)
      setTimeout(() => setCopiedId((id) => (id === eventId ? null : id)), 1500)
    })
  }

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setShown(PAGE_SIZE)
  }

  const visible = filtered.slice(0, shown)

  // Upcoming events that still need something before the day
  const attention = useMemo(() => events.flatMap((e) => {
    if (e.status === 'closed' || daysUntil(e.event_date) < 0) return []
    const items: string[] = []
    if (!e.venue_type || e.venue_type === 'tba') items.push('venue to be announced')
    if (!e.start_time) items.push('no start time')
    if (stats[e.id]?.registered === 0) items.push('no guests yet')
    if (!e.registration_open) items.push('registration closed')
    return items.length ? [{ event: e, items }] : []
  }), [events, stats])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>My events</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            Manage guests, check-in and badges for each event.
          </p>
        </div>
        <Link href="/events/create" className="btn-primary" style={{ width: 'auto' }}>
          + New event
        </Link>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading events" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ height: '96px', backgroundColor: 'var(--color-surface-muted)' }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '14px', backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700 }}>
            +
          </div>
          <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>No events yet</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            An event is one gathering you check guests in for. Create one, then add its guests and print badges.
          </p>
          <Link href="/events/create" className="btn-primary" style={{ width: 'auto' }}>
            + Create your first event
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <input
              type="search"
              className="input-field"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShown(PAGE_SIZE) }}
              placeholder="Search by name, location or ID"
              aria-label="Search events"
              style={{ flex: '1 1 240px', width: 'auto' }}
            />
            <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setStatusFilter(f.value); setShown(PAGE_SIZE) }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      minHeight: '40px',
                      borderRadius: '999px',
                      fontSize: '14px',
                      fontWeight: active ? 600 : 500,
                      color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      backgroundColor: active ? 'var(--color-primary-soft)' : 'transparent',
                    }}
                  >
                    {f.label}
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8 }}>{counts[f.value] ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <p aria-live="polite" style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
            {filtered.length === events.length
              ? `${events.length} ${events.length === 1 ? 'event' : 'events'}`
              : `${filtered.length} of ${events.length} events`}
          </p>

          {attention.length > 0 && (
            <section className="card" aria-label="Needs attention" style={{ padding: '14px 18px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Needs attention</h2>
              <ul style={{ listStyle: 'none', display: 'grid', gap: '6px', fontSize: '14px' }}>
                {attention.map(({ event, items }) => (
                  <li key={event.id}>
                    <Link href={`/events/${event.id}`} style={{ fontWeight: 600 }}>{event.name}</Link>
                    <span style={{ color: 'var(--color-text-secondary)' }}> · {items.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>No events match</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                Try a different name, location or ID, or show all statuses.
              </p>
              <button type="button" onClick={clearFilters} className="btn-secondary" style={{ width: 'auto' }}>
                Clear search and filters
              </button>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visible.map((event) => {
                const live = event.status === 'live'
                return (
                  <li key={event.id} className="card event-row" style={{ position: 'relative', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <h2 style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                          <Link href={`/events/${event.id}`} className="event-row-link" style={{ color: 'inherit' }}>
                            {event.name}
                          </Link>
                        </h2>
                        <EventDetailsStrip event={event} compact />
                        <EventProgressRow event={event} stats={stats[event.id]} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                          <code style={{ backgroundColor: 'var(--color-neutral-light)', color: 'var(--color-text-primary)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'ui-monospace, monospace', fontSize: '12px', overflowWrap: 'anywhere' }}>
                            {event.event_id}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyId(event.event_id)}
                            aria-label={`Copy event ID ${event.event_id}`}
                            style={{ position: 'relative', zIndex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', minHeight: '28px', backgroundColor: 'var(--color-surface)' }}
                          >
                            {copiedId === event.event_id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          backgroundColor: live ? 'var(--color-live-soft)' : 'var(--color-neutral-light)',
                          color: live ? 'var(--color-live)' : 'var(--color-text-secondary)',
                        }}>
                          {live && <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-live)' }} />}
                          {event.status}
                        </span>
                        <span aria-hidden="true" style={{ color: 'var(--color-text-secondary)', fontSize: '18px', lineHeight: 1 }}>›</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {shown < filtered.length && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button type="button" onClick={() => setShown((s) => s + PAGE_SIZE)} className="btn-secondary" style={{ width: 'auto' }}>
                Load more
              </button>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                Showing {visible.length} of {filtered.length}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
