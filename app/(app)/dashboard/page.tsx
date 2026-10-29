'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

const STATUS_DOT: Record<string, string> = {
  live: 'bg-(--color-live)',
  upcoming: 'bg-amber-500',
  closed: 'bg-muted-foreground',
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

  const card = 'rounded-xl border border-border bg-card p-5'

  return (
    <div className="max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            An overview across all of your events.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
        <StatCard label="Total events" value={stats.totalEvents} note={`${stats.thisMonth} this month`} />
        <StatCard label="Total attendees" value={stats.totalAttendees} note="across all events" />
        <StatCard label="Checked in" value={stats.checkedIn} note="across all events" accent="border-t-primary" />
        <StatCard label="This month" value={stats.thisMonth} note="events scheduled" accent="border-t-(--color-live)" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <section className={card} aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="mb-1 text-base font-semibold">Registration trend</h2>
          <p className="mb-4 text-[13px] text-muted-foreground">Last {TREND_DAYS} days</p>
          <TrendChart days={trend} />
        </section>

        <section className={card} aria-labelledby="status-heading">
          <h2 id="status-heading" className="mb-4 text-base font-semibold">Events by status</h2>
          <ul className="flex flex-col gap-2.5">
            {(['live', 'upcoming', 'closed'] as const).map((status) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize">
                  <span aria-hidden="true" className={cn('size-2 rounded-full', STATUS_DOT[status])} />
                  {status}
                </span>
                <span className="font-semibold">{byStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={cn(card, 'mt-4')} aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-base font-semibold">Recent events</h2>
          <Link href="/events" className="text-[13px] font-semibold text-primary">
            View all →
          </Link>
        </div>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="flex flex-col">
            {recentEvents.map((e) => (
              <li key={e.id} className="border-t border-border py-2.5 first:border-t-0">
                <Link href={`/events/${e.id}/enter`} className="flex flex-wrap justify-between gap-3">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-[13px] text-muted-foreground">
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

function StatCard({ label, value, note, accent }: { label: string; value: number; note?: string; accent?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-3.5', accent && 'border-t-[3px]', accent)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

// Simple inline bar chart, no charting library: a bar per day, tallest bar scaled to full height.
function TrendChart({ days }: { days: { label: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="flex h-[120px] items-end gap-1">
      {days.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.count}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          {/* the bar height is data, so it stays inline */}
          <div
            className={cn('w-full max-w-[18px] rounded-t-[3px]', d.count > 0 ? 'bg-primary' : 'bg-border')}
            style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
          />
          {i % 3 === 0 && (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">{d.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}
