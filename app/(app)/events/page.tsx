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
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
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
    <div className="mt-2.5 flex flex-wrap items-center gap-4">
      <div className="text-[13px] text-muted-foreground">
        {days > 1 ? (
          <><strong className="text-lg text-foreground">{days}</strong> days to go</>
        ) : (
          <strong className="text-[15px] text-foreground">{dayLabel(event.event_date)}</strong>
        )}
      </div>
      {stats && (
        <div className="max-w-[360px] flex-1 basis-[200px] text-[13px] text-muted-foreground">
          <span>Registered <strong className="text-foreground">{stats.registered}</strong> of {event.capacity} capacity</span>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            {/* the width is data, so it stays inline */}
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">My events</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage guests, check-in and badges for each event.
          </p>
        </div>
        <Button render={<Link href="/events/create" />}>+ New event</Button>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading events" className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[14px] bg-accent text-primary">
            <CalendarDays size={22} />
          </div>
          <p className="mb-1.5 text-base font-semibold">No events yet</p>
          <p className="mx-auto mb-5 max-w-[360px] text-sm leading-normal text-muted-foreground">
            An event is one gathering you check guests in for. Create one, then add its guests and print badges.
          </p>
          <Button render={<Link href="/events/create" />}>+ Create your first event</Button>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 basis-60">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE_SIZE) }}
                placeholder="Search by name, location or ID"
                aria-label="Search events"
                className={cn('h-9 pl-8', query && 'pr-8')}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1.5 flex -translate-y-1/2 text-muted-foreground"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as string); setShown(PAGE_SIZE) }}>
              <TabsList>
                {STATUS_FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="gap-1.5">
                    {f.label}
                    <Badge variant="secondary" className="h-4 px-1.5 text-[11px]">
                      {counts[f.value] ?? 0}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <p aria-live="polite" className="mb-3 text-[13px] text-muted-foreground">
            {filtered.length === events.length
              ? `${events.length} ${events.length === 1 ? 'event' : 'events'}`
              : `${filtered.length} of ${events.length} events`}
          </p>

          {filtered.length === 0 ? (
            <Card className="px-6 py-8 text-center">
              <p className="mb-1 font-semibold">No events match</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Try a different name, location or ID, or show all statuses.
              </p>
              <Button variant="outline" onClick={clearFilters}>Clear search and filters</Button>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((event) => (
                <EventRow key={event.id} event={event} stats={stats[event.id]} onCopyId={copyId} />
              ))}
            </ul>
          )}

          {shown < filtered.length && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <Button variant="outline" onClick={() => setShown((s) => s + PAGE_SIZE)}>
                Load more
              </Button>
              <p className="text-[13px] text-muted-foreground">
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
      {/* Card isn't polymorphic, so the clickable "whole row" is a styled Link. */}
      <Link
        href={`/events/${event.id}/enter`}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-muted-foreground"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold [overflow-wrap:anywhere]">{event.name}</h2>
            <Badge className={badge.className}>
              {badge.dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-(--color-live)" />}
              {badge.label}
            </Badge>
          </div>
          <EventDetailsStrip event={event} compact />
          <EventProgressRow event={event} stats={stats} />
          <div className="mt-1.5 flex items-center gap-1">
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground [overflow-wrap:anywhere]">
              {event.event_id}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy event ID ${event.event_id}`}
              className="relative z-10 flex rounded-md p-1 text-muted-foreground"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <span aria-hidden="true" className="shrink-0 text-lg leading-none text-muted-foreground">›</span>
      </Link>
    </li>
  )
}
