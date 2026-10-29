'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEventRole } from '@/components/EventRoleContext'
import { sectionsForRole } from '@/lib/permissions'

// Navigation between an event's pages. Shows only the sections the user's role on this event allows.
export default function EventTabs({ eventUuid }: { eventUuid: string }) {
  const pathname = usePathname()
  const role = useEventRole()
  const base = `/events/${eventUuid}`

  return (
    <nav aria-label="Event sections" style={{ marginBottom: '24px', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '4px', minWidth: 'max-content' }}>
        <Link href="/events" style={{ padding: '10px 12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          ← Events
        </Link>
        {sectionsForRole(role).map((tab) => {
          const href = base + tab.href
          const active = pathname === href
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: '10px 12px',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
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
