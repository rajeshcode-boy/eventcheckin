'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { EventRoleProvider } from '@/components/EventRoleContext'
import { fetchEventRole } from '@/lib/eventRole'
import { canOpenPath, ROLE_LABELS, sectionsForRole, type EventRole } from '@/lib/permissions'

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.id as string
  const base = `/events/${eventId}`
  const [role, setRole] = useState<EventRole | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchEventRole(eventId)
      .then((r) => {
        if (cancelled) return
        setRole(r)
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [eventId])

  const sections = sectionsForRole(role).map((s) => ({ ...s, href: base + s.href, exact: s.key === 'overview' }))

  const isActive = (s: { href: string; exact?: boolean }) =>
    s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(s.href + '/')

  let content: React.ReactNode = children
  if (state === 'loading') content = <p>Loading...</p>
  else if (state === 'error') content = <p role="alert">Could not check your access to this event. Reload to try again.</p>
  else if (!role) {
    content = (
      <div className="card" style={{ padding: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>You do not have access to this event</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '6px' }}>Ask an event owner or manager to add you to the team.</p>
        <Link href="/events" className="btn-secondary" style={{ display: 'inline-block', marginTop: '12px' }}>Back to events</Link>
      </div>
    )
  } else if (!canOpenPath(role, pathname, base)) {
    content = (
      <div className="card" style={{ padding: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>This page is not part of your role</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '6px' }}>
          You are signed in as {ROLE_LABELS[role]} on this event.
        </p>
        <Link href={sections[0]?.href ?? '/events'} className="btn-secondary" style={{ display: 'inline-block', marginTop: '12px' }}>
          Go to {sections[0]?.label ?? 'events'}
        </Link>
      </div>
    )
  }

  return (
    <EventRoleProvider value={role}>
      <div className="event-layout">
        <nav aria-label="Event sections" className="event-sidebar">
          <p className="event-sidebar-heading">Manage</p>
          {role && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '0 12px 8px' }}>{ROLE_LABELS[role]}</p>}
          {sections.map((s) => {
            const active = isActive(s)
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className="event-sidebar-link"
                style={active ? { color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)', fontWeight: 600 } : undefined}
              >
                <span>{s.label}</span>
              </Link>
            )
          })}
          <Link href={base} className="event-sidebar-link event-sidebar-back">
            <span>← This event</span>
          </Link>
          <Link href="/events" className="event-sidebar-link event-sidebar-back">
            <span>← All events</span>
          </Link>
        </nav>

        <div className="event-main">{content}</div>
      </div>
    </EventRoleProvider>
  )
}
