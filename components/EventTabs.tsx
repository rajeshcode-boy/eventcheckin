'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEventRole } from '@/components/EventRoleContext'
import { sectionsForRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'

// Navigation between an event's pages. Shows only the sections the user's role on this event allows.
export default function EventTabs({ eventUuid }: { eventUuid: string }) {
  const pathname = usePathname()
  const role = useEventRole()
  const base = `/events/${eventUuid}`

  return (
    <nav aria-label="Event sections" className="mb-6 overflow-x-auto border-b border-border">
      <div className="flex min-w-max gap-1">
        <Link href="/events" className="px-3 py-2.5 text-sm text-muted-foreground">
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
              className={cn(
                '-mb-px border-b-2 px-3 py-2.5 text-sm',
                active ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
