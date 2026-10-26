'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/guests', label: 'Attendees' },
  { href: '/dashboard', label: 'Live Dashboard' },
  { href: '/badge-design', label: 'Badge Design' },
  { href: '/badges', label: 'Badge Printing' },
  { href: '/edit', label: 'Edit Event' },
]

// Navigation between an event's pages
export default function EventTabs({ eventUuid }: { eventUuid: string }) {
  const pathname = usePathname()
  const base = `/events/${eventUuid}`

  return (
    <nav aria-label="Event sections" style={{ marginBottom: '24px', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '4px', minWidth: 'max-content' }}>
        <Link href="/events" style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          ← Events
        </Link>
        {TABS.map((tab) => {
          const href = base + tab.href
          const active = pathname === href
          return (
            <Link
              key={tab.href}
              href={href}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: '10px 12px',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                borderBottom: active ? '2px solid var(--color-primary-green)' : '2px solid transparent',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
