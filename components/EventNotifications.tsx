'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react'

interface ActionItem {
  id: string
  eventId: string
  eventName: string
  issues: Array<{
    type: 'venue' | 'time' | 'registration' | 'guests' | 'pending_approvals'
    label: string
    badgeClass: string
  }>
  href: string
  actionLabel: string
}

interface WorkspaceUpdate {
  id: string
  title: string
  subtitle?: string
  at: string
  type: 'milestone' | 'team' | 'registration'
  href?: string
}

const DIGEST_KEY = 'organizerDigestSeenOn'

// Load upcoming events that need attention or have pending guest approvals
async function loadActionItems(): Promise<ActionItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile) return []

  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, status, venue_type, start_time, registration_open, approval_mode')
    .eq('organization_id', profile.organization_id)
    .neq('status', 'closed')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = (events ?? []).filter((e) => new Date(e.event_date + 'T00:00:00') >= today)
  if (upcoming.length === 0) return []

  const { data: regData } = await supabase
    .from('registrations')
    .select('event_id, registration_status')
    .in('event_id', upcoming.map((e) => e.id))

  const regs = regData ?? []
  const counts: Record<string, number> = {}
  const pendingCounts: Record<string, number> = {}

  for (const r of regs) {
    if (!['cancelled', 'rejected'].includes(r.registration_status)) {
      counts[r.event_id] = (counts[r.event_id] ?? 0) + 1
    }
    if (r.registration_status === 'pending') {
      pendingCounts[r.event_id] = (pendingCounts[r.event_id] ?? 0) + 1
    }
  }

  const items: ActionItem[] = []

  for (const e of upcoming) {
    const issues: ActionItem['issues'] = []
    const pending = pendingCounts[e.id] ?? 0

    if (pending > 0) {
      issues.push({
        type: 'pending_approvals',
        label: `${pending} Pending Approval${pending > 1 ? 's' : ''}`,
        badgeClass: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
      })
    }
    if (!e.venue_type || e.venue_type === 'tba') {
      issues.push({
        type: 'venue',
        label: 'Venue TBA',
        badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      })
    }
    if (!e.start_time) {
      issues.push({
        type: 'time',
        label: 'No Start Time',
        badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      })
    }
    if (!counts[e.id]) {
      issues.push({
        type: 'guests',
        label: 'No Guests Yet',
        badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      })
    }
    if (!e.registration_open) {
      issues.push({
        type: 'registration',
        label: 'Registration Closed',
        badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      })
    }

    if (issues.length > 0) {
      const primaryHref = pending > 0 ? `/events/${e.id}/guests` : `/events/${e.id}`
      const primaryLabel = pending > 0 ? 'Review Approvals →' : 'Fix Details →'

      items.push({
        id: e.id,
        eventId: e.id,
        eventName: e.name,
        issues,
        href: primaryHref,
        actionLabel: primaryLabel,
      })
    }
  }

  return items
}

export default function EventNotifications() {
  const pathname = usePathname()
  // Extract event UUID from /events/[uuid]/... paths
  const eventUuid = pathname?.match(/^\/events\/([^/]+)/)?.[1] ?? null
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'actions' | 'updates'>('actions')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [updates, setUpdates] = useState<WorkspaceUpdate[]>([])
  const [actionSeen, setActionSeen] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load Action Items once per session/day
  useEffect(() => {
    let active = true
    loadActionItems()
      .then((list) => {
        if (!active) return
        const today = new Date().toISOString().slice(0, 10)
        setActionItems(list)
        setActionSeen(localStorage.getItem(DIGEST_KEY) === today)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [pathname])

  // Realtime subscription for workspace updates
  useEffect(() => {
    const pushUpdate = (update: Omit<WorkspaceUpdate, 'id' | 'at'>) => {
      setUpdates((prev) => [
        {
          id: crypto.randomUUID(),
          at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          ...update,
        },
        ...prev,
      ].slice(0, 20))
    }

    if (!eventUuid) return

    // Listen to major event-level milestones
    const channel = supabase
      .channel(`workspace-notifs-${eventUuid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventUuid}` },
        (payload) => {
          const newStatus = payload.new?.status
          const oldStatus = payload.old?.status
          if (newStatus && oldStatus && newStatus !== oldStatus) {
            pushUpdate({
              title: newStatus === 'closed' ? 'Check-in Closed' : 'Check-in Opened',
              subtitle: payload.new?.name ? `Gate status changed for ${payload.new.name}` : undefined,
              type: 'milestone',
              href: `/events/${eventUuid}/desk`,
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const r = payload.new as { full_name?: string; source?: string }
          if (r.source === 'walkin') {
            pushUpdate({
              title: 'On-site Walk-In Registered',
              subtitle: `${r.full_name ?? 'Guest'} joined at gate`,
              type: 'registration',
              href: `/events/${eventUuid}/desk`,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventUuid])

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = (actionSeen ? 0 : actionItems.length) + updates.length

  const toggle = () => {
    if (!open && !actionSeen) {
      localStorage.setItem(DIGEST_KEY, new Date().toISOString().slice(0, 10))
      setActionSeen(true)
    }
    setOpen(!open)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} new` : ''}`}
        onClick={toggle}
        className={cn(
          'relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground',
          open ? 'bg-accent text-accent-foreground' : 'bg-card'
        )}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-[3px] text-[10px] leading-none font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute -right-[2px] -bottom-[2px] size-[7px] rounded-full border border-card bg-(--color-live)"
          title="Notification listener active"
        />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[350px] sm:w-[400px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
            <div>
              <h3 className="text-sm font-bold text-foreground">Action Center</h3>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 rounded-full bg-(--color-live)" />
                {eventUuid ? 'Connected to event workspace' : 'All systems up to date'}
              </p>
            </div>
            {updates.length > 0 && (
              <button
                type="button"
                onClick={() => setUpdates([])}
                className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear updates
              </button>
            )}
          </div>

          {/* Sub-Tabs: Actions Required vs Updates */}
          <div className="flex border-b border-border bg-muted/10 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('actions')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all',
                activeTab === 'actions'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <AlertTriangle size={13} className={actionItems.length > 0 ? 'text-amber-500' : 'text-muted-foreground'} />
              <span>Action Required</span>
              {actionItems.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {actionItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('updates')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all',
                activeTab === 'updates'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles size={13} className={updates.length > 0 ? 'text-primary' : 'text-muted-foreground'} />
              <span>Workspace Updates</span>
              {updates.length > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                  {updates.length}
                </span>
              )}
            </button>
          </div>

          {/* Content Body */}
          <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5">
            {activeTab === 'actions' && (
              <>
                {actionItems.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto size-9 text-emerald-500 mb-2" />
                    <h4 className="text-sm font-bold text-foreground">All Events Ready!</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px] mx-auto">
                      All your upcoming events have venues, schedules, and active registration.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      Pre-Flight Checklist ({actionItems.length} Events Need Attention)
                    </p>
                    {actionItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-card p-3 shadow-xs hover:border-primary/40 transition-colors"
                      >
                        <h4 className="font-bold text-xs sm:text-sm text-foreground">
                          {item.eventName}
                        </h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.issues.map((iss) => (
                            <span
                              key={iss.label}
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                                iss.badgeClass
                              )}
                            >
                              {iss.label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex justify-end border-t border-border/40 pt-2">
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <span>{item.actionLabel}</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'updates' && (
              <>
                {updates.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Bell className="mx-auto size-8 opacity-30 mb-2" />
                    <h4 className="text-sm font-semibold text-foreground">No Recent Updates</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[240px] mx-auto">
                      Milestone events, gate status changes, and on-site walk-ins will appear here.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                    {updates.map((update) => (
                      <li key={update.id} className="p-3 transition-colors hover:bg-muted/30">
                        {update.href ? (
                          <Link
                            href={update.href}
                            onClick={() => setOpen(false)}
                            className="block"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-foreground">
                                {update.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {update.at}
                              </span>
                            </div>
                            {update.subtitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {update.subtitle}
                              </p>
                            )}
                          </Link>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-foreground">
                                {update.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {update.at}
                              </span>
                            </div>
                            {update.subtitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {update.subtitle}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
