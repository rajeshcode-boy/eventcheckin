'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Search,
  Plus,
  QrCode,
  Users,
  IdCard,
  Radio,
  Calendar,
  MapPin,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  LayoutGrid,
  ListFilter,
  Layers,
  ChevronRight,
  Clock,
  Flame,
  Award,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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

interface Props {
  events: EventRow[]
  registrations: RegistrationRow[]
  checkins: CheckinRow[]
  userName?: string
  orgName?: string
  stats: {
    totalEvents: number
    thisMonth: number
    totalAttendees: number
    checkedIn: number
  }
  byStatus: Record<string, number>
  trend: { label: string; count: number }[]
  onRefresh: () => void
  onToggleView: (view: 'canva' | 'classic') => void
  currentView: 'canva' | 'classic'
}

const TEMPLATES = [
  {
    id: 'tech-summit',
    title: 'Tech Summit & Conference',
    badge: 'Popular',
    desc: 'Multi-tier VIP & Speaker badges, entrance kiosk, and real-time arrival velocity.',
    icon: Flame,
    color: 'from-emerald-500 to-teal-700',
    tags: ['Conference', 'QR Badges', 'Kiosk'],
  },
  {
    id: 'workshop',
    title: 'Workshop & Masterclass',
    badge: 'Hands-on',
    desc: 'Compact attendee name tags, digital check-in roster, and walk-in pass generation.',
    icon: Award,
    color: 'from-teal-600 to-cyan-700',
    tags: ['Training', 'Name Tags', 'Roster'],
  },
  {
    id: 'vip-dinner',
    title: 'Executive VIP Dinner & Gala',
    badge: 'Exclusive',
    desc: 'Luxury badge cards, discreet guest list arrival verification, and seating checks.',
    icon: Sparkles,
    color: 'from-amber-500 to-emerald-800',
    tags: ['Gala', 'Exclusive', 'Table RSVP'],
  },
  {
    id: 'community-meetup',
    title: 'Community Meetup & Hackathon',
    badge: 'Fast-Track',
    desc: 'Instant self-registration links, camera scanner mode, and mobile pass downloads.',
    icon: Zap,
    color: 'from-blue-600 to-teal-600',
    tags: ['Meetup', 'Self Check-in', 'Mobile'],
  },
]

export default function CanvaStudioDashboard({
  events,
  registrations,
  checkins,
  userName = 'Organizer',
  orgName = 'EventCheckin',
  stats,
  byStatus,
  trend,
  onRefresh,
  onToggleView,
  currentView,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'live' | 'upcoming' | 'closed'>('all')

  // Calculate check-in rate
  const checkinRate = useMemo(() => {
    if (!stats.totalAttendees) return 0
    return Math.round((stats.checkedIn / stats.totalAttendees) * 100)
  }, [stats])

  // Filter events based on search query and category
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.event_id.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = selectedCategory === 'all' || e.status === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [events, searchQuery, selectedCategory])

  // Get active registrations and checkins per event for display
  const eventStatsMap = useMemo(() => {
    const map = new Map<string, { regs: number; checks: number; pct: number }>()
    for (const e of events) {
      const eRegs = registrations.filter(
        (r) => r.event_id === e.id && !['cancelled', 'rejected'].includes(r.registration_status)
      ).length
      const eChecks = checkins.filter((c) => c.event_id === e.id).length
      const pct = eRegs > 0 ? Math.min(100, Math.round((eChecks / eRegs) * 100)) : 0
      map.set(e.id, { regs: eRegs, checks: eChecks, pct })
    }
    return map
  }, [events, registrations, checkins])

  // Time of day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const latestEvent = events[0]

  return (
    <div className="space-y-8 pb-12">
      {/* Top Bar: View Switcher & Quick Meta */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-(--color-live) animate-pulse" />
          <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {orgName}
          </span>
          <span className="text-muted-foreground/40">•</span>
          <Badge variant="secondary" className="rounded-full px-3 py-0.5 text-xs font-medium">
            ✨ Studio Experience
          </Badge>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-xs">
          <button
            type="button"
            onClick={() => onToggleView('canva')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all',
              currentView === 'canva'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles size={13} />
            Canva Studio
          </button>
          <button
            type="button"
            onClick={() => onToggleView('classic')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all',
              currentView === 'classic'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid size={13} />
            Classic Table
          </button>
        </div>
      </div>

      {/* Signature Canva Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#103E33] via-[#165143] to-[#0A2620] p-6 text-white shadow-xl sm:p-10">
        {/* Decorative Floating Mesh Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-teal-400/15 blur-3xl"
        />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
            <Sparkles size={14} className="text-emerald-300" />
            <span>Event Creation & Check-in Studio</span>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-4xl">
            {greeting}, {userName.split(' ')[0]}!
          </h1>
          <p className="mt-2 text-sm text-emerald-100/90 sm:text-base">
            What gathering are you bringing to life today? Design badges, launch door kiosks, or welcome your guests in seconds.
          </p>

          {/* Interactive Omni-Search Bar */}
          <div className="relative mt-6 max-w-xl">
            <Search
              size={18}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-white/60"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, venues, attendees, or pass styles..."
              className="h-12 w-full rounded-full border-white/20 bg-white/15 pl-11 pr-4 text-sm text-white placeholder:text-white/60 backdrop-blur-md transition-all focus:border-white/40 focus:bg-white/25 focus:ring-2 focus:ring-emerald-300/50"
            />
          </div>
        </div>

        {/* Canva Quick-Action Tile Ribbon */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Link
            href="/events/create"
            className="group flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-white/20"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-400/25 text-emerald-200 transition-transform group-hover:scale-110">
              <Plus size={22} />
            </div>
            <span className="text-xs font-semibold text-white">New Event</span>
          </Link>

          {latestEvent ? (
            <Link
              href={`/events/${latestEvent.id}/badge-design`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-white/20"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-teal-400/25 text-teal-200 transition-transform group-hover:scale-110">
                <IdCard size={22} />
              </div>
              <span className="text-xs font-semibold text-white">Badge Studio</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-center opacity-60">
              <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <IdCard size={22} />
              </div>
              <span className="text-xs font-medium text-white/70">Badge Studio</span>
            </div>
          )}

          {latestEvent ? (
            <Link
              href={`/events/${latestEvent.id}/desk`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-white/20"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-400/25 text-cyan-200 transition-transform group-hover:scale-110">
                <QrCode size={22} />
              </div>
              <span className="text-xs font-semibold text-white">Entrance Kiosk</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-center opacity-60">
              <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <QrCode size={22} />
              </div>
              <span className="text-xs font-medium text-white/70">Entrance Kiosk</span>
            </div>
          )}

          {latestEvent ? (
            <Link
              href={`/events/${latestEvent.id}/guests`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-white/20"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-400/25 text-amber-200 transition-transform group-hover:scale-110">
                <Users size={22} />
              </div>
              <span className="text-xs font-semibold text-white">Guest Roster</span>
            </Link>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-center opacity-60">
              <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <Users size={22} />
              </div>
              <span className="text-xs font-medium text-white/70">Guest Roster</span>
            </div>
          )}

          {latestEvent ? (
            <Link
              href={`/events/${latestEvent.id}/dashboard`}
              className="group col-span-2 sm:col-span-1 flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-3.5 text-center backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/30 hover:bg-white/20"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-400/25 text-indigo-200 transition-transform group-hover:scale-110">
                <Radio size={22} />
              </div>
              <span className="text-xs font-semibold text-white">Live Telemetry</span>
            </Link>
          ) : (
            <div className="col-span-2 sm:col-span-1 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-center opacity-60">
              <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white">
                <Radio size={22} />
              </div>
              <span className="text-xs font-medium text-white/70">Live Telemetry</span>
            </div>
          )}
        </div>
      </div>

      {/* Canva Metric Badges Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="group rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold tracking-wide uppercase">All Events</span>
            <Calendar size={18} className="text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{stats.totalEvents}</span>
            <span className="text-xs text-muted-foreground">({stats.thisMonth} this month)</span>
          </div>
        </div>

        <div className="group rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold tracking-wide uppercase">Total Attendees</span>
            <Users size={18} className="text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{stats.totalAttendees}</span>
            <span className="text-xs text-muted-foreground">registered</span>
          </div>
        </div>

        <div className="group rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold tracking-wide uppercase">Checked In</span>
            <CheckCircle2 size={18} className="text-(--color-live)" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{stats.checkedIn}</span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {checkinRate}% attendance
            </Badge>
          </div>
        </div>

        <div className="group rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold tracking-wide uppercase">Live Events</span>
            <Radio size={18} className="text-(--color-live) animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">{byStatus.live || 0}</span>
            <span className="text-xs text-muted-foreground">active right now</span>
          </div>
        </div>
      </div>

      {/* "Start with an Event Kit" (Canva Template Row) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Start with an Event Kit
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Pre-configured templates optimized for your gathering format.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon
            return (
              <div
                key={tpl.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        'flex size-10 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-xs',
                        tpl.color
                      )}
                    >
                      <Icon size={20} />
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      {tpl.badge}
                    </Badge>
                  </div>

                  <h3 className="mt-3.5 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {tpl.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {tpl.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {tpl.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    className="rounded-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                    render={<Link href="/events/create" />}
                  >
                    Use Kit →
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* "Your Events & Passes" (Visual Card Gallery) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Your Events & Check-in Desks
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Live attendance progress and quick operational shortcuts for each gathering.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5">
            {(['all', 'live', 'upcoming', 'closed'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {cat} ({cat === 'all' ? events.length : byStatus[cat] || 0})
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Calendar size={26} />
            </div>
            <h3 className="text-base font-bold text-foreground">No matching events found</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              {searchQuery
                ? `No events match "${searchQuery}". Try a different keyword.`
                : 'Get started by creating your first event kit.'}
            </p>
            <Button className="mt-5 rounded-full" render={<Link href="/events/create" />}>
              + Create an Event
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((e) => {
              const eStats = eventStatsMap.get(e.id) || { regs: 0, checks: 0, pct: 0 }
              const isLive = e.status === 'live'

              return (
                <div
                  key={e.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card shadow-xs transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
                >
                  {/* Card Visual Header Banner */}
                  <div
                    className={cn(
                      'relative h-28 w-full p-4 flex items-start justify-between text-white overflow-hidden',
                      isLive
                        ? 'bg-linear-to-r from-emerald-600 via-teal-700 to-emerald-900'
                        : e.status === 'upcoming'
                        ? 'bg-linear-to-r from-slate-700 via-teal-800 to-slate-900'
                        : 'bg-linear-to-r from-zinc-700 to-zinc-900'
                    )}
                  >
                    {/* Subtle decorative mesh lines */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-white/10 blur-xl"
                    />

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        )}
                      />
                      <span className="capitalize">{e.status}</span>
                    </div>

                    <div className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-md">
                      {new Date(e.event_date + 'T00:00:00').toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {e.name}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin size={13} className="shrink-0 text-primary" />
                        <span className="truncate">{e.location || 'Location TBA'}</span>
                      </div>

                      {/* Attendance Progress Meter */}
                      <div className="mt-4 rounded-xl bg-muted/50 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {eStats.checks} of {eStats.regs} checked in
                          </span>
                          <span className="font-bold text-primary">{eStats.pct}%</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all duration-500 rounded-full"
                            style={{ width: `${eStats.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Operational Action Shortcuts */}
                    <div className="mt-5 grid grid-cols-3 gap-2 pt-3 border-t border-border">
                      <Link
                        href={`/events/${e.id}/enter`}
                        className="col-span-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-transform active:scale-98 hover:bg-primary/90"
                      >
                        <QrCode size={14} />
                        <span>Open Check-in Hub</span>
                      </Link>

                      <Link
                        href={`/events/${e.id}/badge-design`}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Design Badges"
                      >
                        <IdCard size={13} />
                        <span>Badges</span>
                      </Link>

                      <Link
                        href={`/events/${e.id}/guests`}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Manage Guests"
                      >
                        <Users size={13} />
                        <span>Guests</span>
                      </Link>

                      <Link
                        href={`/events/${e.id}/dashboard`}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Live Telemetry"
                      >
                        <Radio size={13} />
                        <span>Stats</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 14-Day Registration Trend Chart (Modernized) */}
      <Card className="rounded-3xl border border-border p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Registration Velocity</h3>
            <p className="text-xs text-muted-foreground">Activity across all events over the last 14 days</p>
          </div>
          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
            <TrendingUp size={12} className="mr-1 text-(--color-live)" />
            Realtime
          </Badge>
        </div>

        <div className="flex h-[130px] items-end gap-1.5 pt-4">
          {(() => {
            const max = Math.max(1, ...trend.map((d) => d.count))
            return trend.map((d, i) => (
              <div
                key={i}
                title={`${d.label}: ${d.count}`}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <div
                  className={cn(
                    'w-full max-w-[22px] rounded-t-md transition-all group-hover:opacity-80',
                    d.count > 0 ? 'bg-primary' : 'bg-muted'
                  )}
                  style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
                />
                {i % 2 === 0 && (
                  <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                    {d.label}
                  </span>
                )}
              </div>
            ))
          })()}
        </div>
      </Card>
    </div>
  )
}
