'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface NotifItem {
  id: string
  text: string
  at: string
}

interface DigestItem {
  id: string
  text: string
  href: string
}

const DIGEST_KEY = 'morningDigestSeenOn'

// Upcoming events that still need something, shown once each morning
async function loadMorningDigest(): Promise<DigestItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile) return []

  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, status, venue_type, start_time, registration_open')
    .eq('organization_id', profile.organization_id)
    .neq('status', 'closed')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = (events ?? []).filter((e) => new Date(e.event_date + 'T00:00:00') >= today)
  if (upcoming.length === 0) return []

  let regs: { event_id: string; registration_status: string }[] = []
  const { data: regData } = await supabase
    .from('registrations')
    .select('event_id, registration_status')
    .in('event_id', upcoming.map((e) => e.id))
  regs = regData ?? []
  const counts: Record<string, number> = {}
  for (const r of regs) {
    if (!['cancelled', 'rejected'].includes(r.registration_status)) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1
  }

  return upcoming.flatMap((e) => {
    const reasons: string[] = []
    if (!e.venue_type || e.venue_type === 'tba') reasons.push('venue to be announced')
    if (!e.start_time) reasons.push('no start time')
    if (!counts[e.id]) reasons.push('no guests yet')
    if (!e.registration_open) reasons.push('registration closed')
    return reasons.length ? [{ id: e.id, text: `${e.name}: ${reasons.join(', ')}`, href: `/events/${e.id}` }] : []
  })
}

export default function EventNotifications() {
  const pathname = usePathname()
  // Extract event UUID from /events/[uuid]/... paths
  const eventUuid = pathname?.match(/^\/events\/([^/]+)/)?.[1] ?? null
  const [items, setItems] = useState<NotifItem[]>([])
  const [open, setOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [digest, setDigest] = useState<DigestItem[]>([])
  const [digestSeen, setDigestSeen] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  // Morning list: loaded once per visit, badged until the bell is opened that day
  useEffect(() => {
    let active = true
    loadMorningDigest()
      .then((list) => {
        if (!active) return
        const today = new Date().toISOString().slice(0, 10)
        setDigest(list)
        setDigestSeen(localStorage.getItem(DIGEST_KEY) === today)
      })
      .catch(() => {
        // The bell still works without the morning list
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!eventUuid) {
      setConnected(false)
      return
    }

    const push = (text: string) =>
      setItems((prev) => [{ id: crypto.randomUUID(), text, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 30))

    const channel = supabase
      .channel(`event-notifs-${eventUuid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const r = payload.new as { full_name?: string; source?: string }
          const who = r.full_name ?? 'Guest'
          push(r.source === 'walkin' ? `${who} walked in` : `${who} registered`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkins', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const c = payload.new as { full_name?: string }
          push(`${c.full_name ?? 'Guest'} checked in`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const r = payload.new as { full_name?: string; badge_collected_at?: string | null }
          const old = payload.old as { badge_collected_at?: string | null }
          if (r.badge_collected_at && !old.badge_collected_at) {
            push(`${r.full_name ?? 'Guest'} picked up badge`)
          }
        }
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [eventUuid])

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = items.length + (digestSeen ? 0 : digest.length)

  const toggle = () => {
    // Opening the bell counts the morning list as seen for today
    if (!open && !digestSeen) {
      localStorage.setItem(DIGEST_KEY, new Date().toISOString().slice(0, 10))
      setDigestSeen(true)
    }
    setOpen(!open)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}
        onClick={toggle}
        className={cn(
          'relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground',
          open ? 'bg-accent' : 'bg-card'
        )}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-[3px] text-[10px] leading-none font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {connected && (
          <span aria-hidden="true" className="absolute -right-[3px] -bottom-[3px] size-[7px] rounded-full border border-card bg-(--color-live)" />
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-[280px] overflow-hidden rounded-[14px] border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
            <span className="text-[13px] font-semibold">Live activity</span>
            <div className="flex items-center gap-2">
              <span className={cn('text-[11px]', connected ? 'text-(--color-live)' : 'text-muted-foreground')}>
                {connected ? '● live' : '○ connecting…'}
              </span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="cursor-pointer rounded border border-border bg-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {digest.length > 0 && (
              <div className="border-b border-border">
                <p className="px-3.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Today: {digest.length} upcoming {digest.length === 1 ? 'event needs' : 'events need'} attention
                </p>
                <ul className="pb-1.5">
                  {digest.map((d) => (
                    <li key={d.id}>
                      <Link href={d.href} onClick={() => setOpen(false)} className="block px-3.5 py-2 text-[13px] leading-snug text-foreground">
                        {d.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {items.length === 0 && digest.length > 0 ? null : items.length === 0 ? (
              <p className="px-3.5 py-5 text-center text-[13px] text-muted-foreground">
                {eventUuid ? 'No activity yet — updates appear here in real time.' : 'Open an event to see live activity.'}
              </p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2 border-b border-border px-3.5 py-2.5">
                    <span className="text-[13px] leading-snug text-foreground">{item.text}</span>
                    <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">{item.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
