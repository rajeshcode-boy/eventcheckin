'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface EventRow {
  id: string
  event_id: string
  name: string
  location: string
  event_date: string
  status: 'upcoming' | 'live' | 'closed'
  created_at: string
}

interface RegistrationRow {
  id: string
  event_id: string
  registration_status: string
  created_at: string
}

interface CheckinRow {
  id: string
  event_id: string
}

const STATUS_COLOR: Record<string, string> = {
  live: 'var(--color-live)',
  upcoming: 'var(--color-amber-warning)',
  closed: 'var(--color-text-secondary)',
}

const TREND_DAYS = 14

export default function OrgDashboardPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (!profile) return

      const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('id, event_id, name, location, event_date, status, created_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

      if (eventsError) {
        setError("Couldn't load your dashboard. Refresh the page to try again.")
        return
      }
      const rows = (eventRows ?? []) as EventRow[]
      setEvents(rows)

      const eventIds = rows.map((e) => e.id)
      if (eventIds.length === 0) {
        setRegistrations([])
        setCheckins([])
        return
      }

      const [regRes, checkinRes] = await Promise.all([
        supabase.from('registrations').select('id, event_id, registration_status, created_at').in('event_id', eventIds),
        supabase.from('checkins').select('id, event_id').in('event_id', eventIds),
      ])
      setRegistrations((regRes.data ?? []) as RegistrationRow[])
      setCheckins((checkinRes.data ?? []) as CheckinRow[])
    } catch {
      setError("Couldn't load your dashboard. Refresh the page to try again.")
    } finally {
      setLoading(false)
    }
  }

  const activeRegistrations = useMemo(
    () => registrations.filter((r) => !['cancelled', 'rejected'].includes(r.registration_status)),
    [registrations]
  )

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = events.filter((e) => {
      const d = new Date(e.event_date + 'T00:00:00')
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
    return {
      totalEvents: events.length,
      thisMonth,
      totalAttendees: activeRegistrations.length,
      checkedIn: checkins.length,
    }
  }, [events, activeRegistrations, checkins])

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = { live: 0, upcoming: 0, closed: 0 }
    for (const e of events) counts[e.status] = (counts[e.status] ?? 0) + 1
    return counts
  }, [events])

  // Registrations per day for the last 14 days, oldest first
  const trend = useMemo(() => {
    const days: { label: string; count: number }[] = []
    const byDay = new Map<string, number>()
    for (const r of activeRegistrations) {
      const key = r.created_at.slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + 1)
    }
    const today = new Date()
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ label: d.toLocaleDateString([], { day: 'numeric', month: 'short' }), count: byDay.get(key) ?? 0 })
    }
    return days
  }, [activeRegistrations])

  const recentEvents = events.slice(0, 5)

  if (loading) return <p>Loading dashboard...</p>

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            An overview across all of your events.
          </p>
        </div>
        <button type="button" onClick={load} className="btn-secondary" style={{ width: 'auto' }}>
          Refresh
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <StatCard label="Total events" value={stats.totalEvents} note={`${stats.thisMonth} this month`} />
        <StatCard label="Total attendees" value={stats.totalAttendees} note="across all events" />
        <StatCard label="Checked in" value={stats.checkedIn} note="across all events" color="var(--color-primary)" />
        <StatCard label="This month" value={stats.thisMonth} note="events scheduled" color="var(--color-live)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
        <section className="card" style={{ padding: '20px' }} aria-labelledby="trend-heading">
          <h2 id="trend-heading" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Registration trend</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Last {TREND_DAYS} days</p>
          <TrendChart days={trend} />
        </section>

        <section className="card" style={{ padding: '20px' }} aria-labelledby="status-heading">
          <h2 id="status-heading" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Events by status</h2>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(['live', 'upcoming', 'closed'] as const).map((status) => (
              <li key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                  <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: STATUS_COLOR[status] }} />
                  {status}
                </span>
                <span style={{ fontWeight: 600 }}>{byStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" style={{ padding: '20px', marginTop: '16px' }} aria-labelledby="recent-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 id="recent-heading" style={{ fontSize: '16px', fontWeight: 600 }}>Recent events</h2>
          <Link href="/events" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
            View all →
          </Link>
        </div>
        {recentEvents.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>No events yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
            {recentEvents.map((e, i) => (
              <li key={e.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)', padding: '10px 0' }}>
                <Link href={`/events/${e.id}/enter`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>{e.name}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {e.location} · {new Date(e.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, note, color }: { label: string; value: number; note?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderTop: color ? `3px solid ${color}` : undefined }}>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{value}</p>
      {note && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{note}</p>}
    </div>
  )
}

// Simple inline bar chart, no charting library: a bar per day, tallest bar scaled to full height.
function TrendChart({ days }: { days: { label: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
      {days.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
          <div
            style={{
              width: '100%',
              maxWidth: '18px',
              height: `${Math.max(2, (d.count / max) * 100)}%`,
              backgroundColor: d.count > 0 ? 'var(--color-primary)' : 'var(--color-border)',
              borderRadius: '3px 3px 0 0',
            }}
          />
          {i % 3 === 0 && (
            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{d.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}
