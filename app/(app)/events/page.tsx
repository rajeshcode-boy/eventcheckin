'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast } from 'sonner'
import { Search, X, Copy, Check, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EventDetailsStrip from '@/components/EventDetailsStrip'

interface Stats {
  registered: number
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

// Countdown in bold ("49 days to go"), then capacity and how many have registered so far
function EventProgressRow({ event, stats }: { event: Event; stats: Stats | undefined }) {
  const days = daysUntil(event.event_date)
  const pct = stats && event.capacity > 0 ? Math.min(100, Math.round((stats.registered / event.capacity) * 100)) : 0
  return (
    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        {days > 1 ? (
          <><strong style={{ fontSize: '18px', color: 'var(--color-text-primary)' }}>{days}</strong> days to go</>
        ) : (
          <strong style={{ fontSize: '15px', color: 'var(--color-text-primary)' }}>{dayLabel(event.event_date)}</strong>
        )}
      </div>
      {stats && (
        <div style={{ flex: '1 1 200px', maxWidth: '360px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <span>Registered <strong style={{ color: 'var(--color-text-primary)' }}>{stats.registered}</strong> of {event.capacity} capacity</span>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ marginTop: '6px', height: '6px', borderRadius: '999px', backgroundColor: 'var(--color-neutral-light)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
          </div>
        </div>
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
  archived_at: string | null
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
  { value: 'archived', label: 'Archived' },
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

      // Registrations so far per event, for the capacity line on each card
      const ids = (data || []).map((e) => e.id)
      if (ids.length > 0) {
        const { data: regs } = await supabase.from('registrations').select('event_id, registration_status').in('event_id', ids)
        const next: Record<string, Stats> = {}
        for (const id of ids) next[id] = { registered: 0 }
        for (const r of regs ?? []) {
          if (!['cancelled', 'rejected'].includes(r.registration_status) && next[r.event_id]) next[r.event_id]!.registered += 1
        }
        setStats(next)
      }
    } catch (err) {
      setError("Couldn't load your events. Refresh the page to try again.")
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: 0 }
    for (const e of events) {
      if (e.archived_at) {
        result.archived = (result.archived ?? 0) + 1
      } else {
        result.all = (result.all ?? 0) + 1
        result[e.status] = (result[e.status] ?? 0) + 1
      }
    }
    return result
  }, [events])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (statusFilter === 'archived' ? !e.archived_at : e.archived_at) return false
      if (statusFilter !== 'all' && statusFilter !== 'archived' && e.status !== statusFilter) return false
      if (!q) return true
      return [e.name, e.location, e.event_id].some((v) => v?.toLowerCase().includes(q))
    })
  }, [events, query, statusFilter])

  const copyId = (eventId: string) => {
    navigator.clipboard.writeText(eventId).then(() => {
      toast.success('Copied!', { description: eventId })
    })
  }

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setShown(PAGE_SIZE)
  }

  const visible = filtered.slice(0, shown)


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>My events</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            Manage guests, check-in and badges for each event.
          </p>
        </div>
        <Button render={<Link href="/events/create" />}>+ New event</Button>
      </div>

      {error && (
        <div className="alert-error" role="alert" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading events" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: '72px', width: '100%' }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '14px', backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarDays size={22} />
          </div>
          <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px' }}>No events yet</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            An event is one gathering you check guests in for. Create one, then add its guests and print badges.
          </p>
          <Button render={<Link href="/events/create" />}>+ Create your first event</Button>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
              <Input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE_SIZE) }}
                placeholder="Search by name, location or ID"
                aria-label="Search events"
                style={{ paddingLeft: '32px', paddingRight: query ? '32px' : undefined, height: '36px' }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', display: 'flex' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as string); setShown(PAGE_SIZE) }}>
              <TabsList>
                {STATUS_FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} style={{ gap: '6px' }}>
                    {f.label}
                    <Badge variant="secondary" style={{ height: '16px', padding: '0 5px', fontSize: '11px' }}>
                      {counts[f.value] ?? 0}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <p aria-live="polite" style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
            {filtered.length === events.length
              ? `${events.length} ${events.length === 1 ? 'event' : 'events'}`
              : `${filtered.length} of ${events.length} events`}
          </p>


          {filtered.length === 0 ? (
            <Card style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '4px' }}>No events match</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                Try a different name, location or ID, or show all statuses.
              </p>
              <Button variant="outline" onClick={clearFilters}>Clear search and filters</Button>
            </Card>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visible.map((event) => (
                <EventRow key={event.id} event={event} stats={stats[event.id]} onCopyId={copyId} />
              ))}
            </ul>
          )}

          {shown < filtered.length && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Button variant="outline" onClick={() => setShown((s) => s + PAGE_SIZE)}>
                Load more
              </Button>
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

const STATUS_BADGE: Record<string, { className: string; label: string; dot?: boolean }> = {
  upcoming: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', label: 'Upcoming' },
  live: { className: 'bg-[var(--color-live-soft)] text-[var(--color-live)]', label: 'Live', dot: true },
  closed: { className: 'bg-muted text-muted-foreground', label: 'Closed' },
}

function EventRow({ event, stats, onCopyId }: { event: Event; stats: Stats | undefined; onCopyId: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.closed!

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCopyId(event.event_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <li>
      {/* Card isn't polymorphic, so the clickable "whole row" is a styled Link
          using the app's existing .card class rather than wrapping <Card>. */}
      <Link
        href={`/events/${event.id}`}
        className="card"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', color: 'inherit' }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, overflowWrap: 'anywhere' }}>{event.name}</h2>
            <Badge className={badge.className}>
              {badge.dot && <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-live)' }} />}
              {badge.label}
            </Badge>
          </div>
          <EventDetailsStrip event={event} compact />
          <EventProgressRow event={event} stats={stats} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <code style={{ backgroundColor: 'var(--color-neutral-light)', color: 'var(--color-text-primary)', padding: '2px 6px', borderRadius: '6px', fontFamily: 'ui-monospace, monospace', fontSize: '11px', overflowWrap: 'anywhere' }}>
              {event.event_id}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy event ID ${event.event_id}`}
              style={{ position: 'relative', zIndex: 1, color: 'var(--color-text-secondary)', padding: '4px', borderRadius: '6px', display: 'flex' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--color-text-secondary)', fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>›</span>
      </Link>
    </li>
  )
}
