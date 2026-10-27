'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Event {
  id: string
  event_id: string
  name: string
  location: string
  event_date: string
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
    } catch (err) {
      setError("Couldn't load your events. Refresh the page to try again.")
    } finally {
      setLoading(false)
    }
  }

  // Filter by status and by name, location or event ID
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

  const visible = filtered.slice(0, shown)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>My events</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>Manage guests, check-in and badges for each event.</p>
        </div>
        <Link href="/events/create" className="btn-primary" style={{ width: 'auto' }}>
          + New event
        </Link>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading events" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ height: '88px', backgroundColor: 'var(--color-neutral-light)' }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>No events yet</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            An event is one gathering you check guests in for. Create one to start adding guests.
          </p>
          <Link href="/events/create" className="btn-primary" style={{ width: 'auto' }}>
            + New event
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
                      padding: '8px 14px',
                      minHeight: '40px',
                      borderRadius: '999px',
                      fontSize: '14px',
                      fontWeight: active ? 600 : 500,
                      color: active ? 'var(--color-primary-green)' : 'var(--color-text-secondary)',
                      backgroundColor: active ? 'var(--color-primary-soft)' : 'transparent',
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', padding: '24px 0', textAlign: 'center' }}>
              No events match your search.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visible.map((event) => (
                <li key={event.id} className="card event-row" style={{ position: 'relative', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>
                        <Link href={`/events/${event.id}`} className="event-row-link" style={{ color: 'inherit' }}>
                          {event.name}
                        </Link>
                      </h2>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                        {event.location} · {new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <code style={{ backgroundColor: 'var(--color-neutral-light)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>
                          {event.event_id}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyId(event.event_id)}
                          aria-label={`Copy event ID ${event.event_id}`}
                          style={{ position: 'relative', zIndex: 1, fontSize: '12px', color: 'var(--color-text-secondary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', minHeight: '28px' }}
                        >
                          {copiedId === event.event_id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        backgroundColor: event.status === 'live' ? 'var(--color-primary-soft)' : 'var(--color-neutral-light)',
                        color: event.status === 'live' ? 'var(--color-primary-green)' : 'var(--color-text-secondary)',
                      }}>
                        {event.status}
                      </span>
                      <span aria-hidden="true" style={{ color: 'var(--color-text-secondary)', fontSize: '18px' }}>›</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {shown < filtered.length && (
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={() => setShown((s) => s + PAGE_SIZE)} className="btn-secondary">
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
