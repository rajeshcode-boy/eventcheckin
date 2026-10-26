'use client'

import { useEffect, useState } from 'react'
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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const ITEMS_PER_PAGE = 5

  useEffect(() => {
    fetchEvents()
  }, [page])

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

      const from = page * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('organization_id', profileData.organization_id)
        .order('event_date', { ascending: false })
        .range(from, to)

      if (fetchError) {
        setError('Failed to load events')
        return
      }

      setEvents(data || [])
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p>Loading events...</p>
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>My Events</h1>
        <Link href="/events/create" className="btn-primary">
          Create Event
        </Link>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          backgroundColor: 'var(--color-neutral-light)',
          borderRadius: '6px',
        }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
            No events yet. Create your first event to get started.
          </p>
          <Link href="/events/create" className="btn-primary">
            Create Event
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              style={{
                padding: '16px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-neutral-light)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
                    {event.name}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                    {event.location} • {new Date(event.event_date).toLocaleDateString()}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    Event ID: <code style={{ backgroundColor: 'var(--color-neutral-light)', padding: '2px 6px', borderRadius: '3px' }}>
                      {event.event_id}
                    </code>
                  </p>
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: '500',
                  backgroundColor: event.status === 'live' ? '#d1fae5' : 'var(--color-neutral-light)',
                  color: event.status === 'live' ? '#065f46' : 'var(--color-text-secondary)',
                }}>
                  {event.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {events.length >= ITEMS_PER_PAGE && (
        <div style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary"
          >
            Previous
          </button>
          <span style={{ padding: '12px 16px' }}>Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="btn-secondary"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
