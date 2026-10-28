'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import EventNotifications from './EventNotifications'

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const eventUuid = params.id as string
  const base = `/events/${eventUuid}`

  const sections = [
    { href: base, label: 'Overview', exact: true },
    { href: `${base}/guests`, label: 'Guests' },
    { href: `${base}/dashboard`, label: 'Dashboard' },
    { href: `${base}/badge-design`, label: 'Badge design' },
    { href: `${base}/badges`, label: 'Badges' },
    { href: `${base}/pickup`, label: 'Pickup' },
    { href: `${base}/edit`, label: 'Settings' },
  ]

  const isActive = (s: { href: string; exact?: boolean }) =>
    s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(s.href + '/')

  return (
    <div className="event-layout">
      <nav aria-label="Event sections" className="event-sidebar">
        <p className="event-sidebar-heading">Manage</p>
        {sections.map((s) => {
          const active = isActive(s)
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? 'page' : undefined}
              className="event-sidebar-link"
              style={active ? { color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)', fontWeight: 600 } : undefined}
            >
              <span>{s.label}</span>
            </Link>
          )
        })}
        <Link href="/events" className="event-sidebar-link event-sidebar-back">
          <span>← All events</span>
        </Link>
      </nav>

      <div className="event-main">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <EventNotifications eventUuid={eventUuid} />
        </div>
        {children}
      </div>
    </div>
  )
}
