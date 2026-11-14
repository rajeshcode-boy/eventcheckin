'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Search,
  X,
  Copy,
  Check,
  Calendar,
  CalendarDays,
  MapPin,
  Clock,
  Users,
  QrCode,
  IdCard,
  Radio,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface Stats {
  registered: number
}

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

const PAGE_SIZE = 12

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
      const {
        data: { user },
      } = await supabase.auth.getUser()

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

      const ids = (data || []).map((e) => e.id)
      if (ids.length > 0) {
        const { data: regs } = await supabase
          .from('registrations')
          .select('event_id, registration_status')
          .in('event_id', ids)
        const next: Record<string, Stats> = {}
        for (const id of ids) next[id] = { registered: 0 }
        for (const r of regs ?? []) {
          if (!['cancelled', 'rejected'].includes(r.registration_status) && next[r.event_id]) {
            next[r.event_id]!.registered += 1
          }
        }
        setStats(next)
      }
    } catch {
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
      return [e.name, e.location, e.event_id, e.city, e.venue_name].some((v) =>
        v?.toLowerCase().includes(q)
      )
    })
  }, [events, query, statusFilter])

  const copyId = (eventId: string) => {
    navigator.clipboard.writeText(eventId).then(() => {
      toast.success('Event ID copied to clipboard!', { description: eventId })
    })
  }

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setShown(PAGE_SIZE)
  }

  const visible = filtered.slice(0, shown)

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">All Events</h1>
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold">
              {events.length} Total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your gatherings, attendee check-in gates, and badge studios.
          </p>
        </div>

        <Link
          href="/events/create"
          className={cn(
            buttonVariants({ size: 'default' }),
            'gap-1.5 rounded-full font-semibold shadow-xs'
          )}
        >
          <Plus size={16} />
          Create Event
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Toolbar: Search & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Search input with fixed max-width */}
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(PAGE_SIZE)
            }}
            placeholder="Search by name, venue, city, or event ID..."
            className="h-10 w-full rounded-full border-border bg-card pl-10 pr-9 text-sm shadow-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value)
                setShown(PAGE_SIZE)
              }}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-all',
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {f.label} ({counts[f.value] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-3xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <CalendarDays size={26} />
          </div>
          <h2 className="text-lg font-bold text-foreground">No events yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Get started by creating your first gathering. You can import guests, design passes, and launch entrance kiosks.
          </p>
          <Link
            href="/events/create"
            className={cn(buttonVariants({ size: 'default' }), 'mt-6 rounded-full')}
          >
            + Create Your First Event
          </Link>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-bold text-foreground">No matching events found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search query or filter tags.
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 rounded-full">
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} stats={stats[event.id]} onCopyId={copyId} />
          ))}
        </div>
      )}

      {shown < filtered.length && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full px-6"
            onClick={() => setShown((s) => s + PAGE_SIZE)}
          >
            Load More Events ({filtered.length - shown} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}

function EventCard({
  event,
  stats,
  onCopyId,
}: {
  event: Event
  stats: Stats | undefined
  onCopyId: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const isLive = event.status === 'live'
  const isUpcoming = event.status === 'upcoming'
  const days = daysUntil(event.event_date)
  const registeredCount = stats?.registered ?? 0
  const capacity = event.capacity || 100
  const pct = Math.min(100, Math.round((registeredCount / capacity) * 100))

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCopyId(event.event_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const eventDateObj = new Date(event.event_date + 'T00:00:00')
  const monthName = eventDateObj.toLocaleDateString([], { month: 'short' })
  const dayNumber = eventDateObj.toLocaleDateString([], { day: 'numeric' })

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
      {/* Visual Header Banner */}
      <div
        className={cn(
          'relative flex h-28 w-full items-start justify-between p-4 text-white overflow-hidden',
          isLive
            ? 'bg-linear-to-r from-emerald-600 via-teal-700 to-emerald-900'
            : isUpcoming
            ? 'bg-linear-to-r from-slate-700 via-teal-800 to-slate-900'
            : 'bg-linear-to-r from-zinc-700 to-zinc-900'
        )}
      >
        {/* Decorative blur mesh */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-white/10 blur-xl"
        />

        {/* Status Pill */}
        <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
          <span
            className={cn(
              'size-2 rounded-full',
              isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            )}
          />
          <span className="capitalize">{event.status}</span>
        </div>

        {/* Date Calendar Badge */}
        <div className="flex flex-col items-center rounded-xl bg-white/20 px-2.5 py-1 text-center backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">
            {monthName}
          </span>
          <span className="text-base font-extrabold leading-tight text-white">{dayNumber}</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h2 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary line-clamp-1">
            {event.name}
          </h2>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin size={13} className="shrink-0 text-primary" />
            <span className="truncate">{event.location || event.city || 'Location TBA'}</span>
          </div>

          {/* Time & Countdown Details */}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {event.start_time || 'Schedule TBA'}
            </span>
            <span className="font-semibold text-foreground">
              {days > 1 ? `${days} days to go` : dayLabel(event.event_date)}
            </span>
          </div>

          {/* Attendance Capacity Progress Meter */}
          <div className="mt-4 rounded-xl bg-muted/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                <Users size={12} className="inline mr-1 text-muted-foreground" />
                {registeredCount} of {capacity} registered
              </span>
              <span className="font-bold text-primary">{pct}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Copyable Event ID */}
          <div className="mt-3 flex items-center justify-between pt-1">
            <code className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground truncate max-w-[190px]">
              {event.event_id}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Copy Event ID"
            >
              {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Card Operational Action Buttons */}
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-3">
          <Link
            href={`/events/${event.id}/enter`}
            className="col-span-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-transform active:scale-98 hover:bg-primary/90"
          >
            <QrCode size={14} />
            <span>Open Check-in Hub</span>
            <ArrowRight size={13} className="ml-0.5" />
          </Link>

          <Link
            href={`/events/${event.id}/badge-design`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Badge Studio"
          >
            <IdCard size={13} />
            <span>Badges</span>
          </Link>

          <Link
            href={`/events/${event.id}/guests`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Manage Guests"
          >
            <Users size={13} />
            <span>Guests</span>
          </Link>

          <Link
            href={`/events/${event.id}/desk`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Live Gate Station"
          >
            <Radio size={13} />
            <span>Gate</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
