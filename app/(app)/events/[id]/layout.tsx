'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { EventRoleProvider } from '@/components/EventRoleContext'
import { RoleBadge } from '@/components/RoleBadge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

  const panel = 'rounded-xl border border-border bg-card p-5'
  const linkClass = 'flex min-h-10 items-center justify-between rounded-[10px] px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-secondary hover:text-foreground max-md:border max-md:border-border max-md:bg-card md:whitespace-normal'

  let content: React.ReactNode = children
  if (state === 'loading') content = <p>Loading...</p>
  else if (state === 'error') content = <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Could not check your access to this event. Reload to try again.</p>
  else if (!role) {
    content = (
      <div className={panel}>
        <h1 className="text-xl font-semibold">You do not have access to this event</h1>
        <p className="mt-1.5 text-muted-foreground">Ask an event owner or manager to add you to the team.</p>
        <Button variant="outline" className="mt-3" render={<Link href="/events" />} nativeButton={false}>Back to events</Button>
      </div>
    )
  } else if (!canOpenPath(role, pathname, base)) {
    content = (
      <div className={panel}>
        <h1 className="text-xl font-semibold">This page is not part of your role</h1>
        <p className="mt-1.5 text-muted-foreground">You are signed in as {ROLE_LABELS[role]} on this event.</p>
        <Button variant="outline" className="mt-3" render={<Link href={sections[0]?.href ?? '/events'} />} nativeButton={false}>
          Go to {sections[0]?.label ?? 'events'}
        </Button>
      </div>
    )
  }

  return (
    <EventRoleProvider value={role}>
      <div className="grid items-start gap-7 max-md:gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Event sections" className="flex gap-1.5 overflow-x-auto pb-1 md:sticky md:top-[84px] md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:block">Manage</p>
          {role && (
            <div className="shrink-0 px-3 pb-2 max-md:flex max-md:items-center max-md:px-0 max-md:pb-0">
              <RoleBadge role={role} />
            </div>
          )}
          {sections.map((s) => {
            const active = isActive(s)
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={active ? 'page' : undefined}
                className={cn(linkClass, active && 'bg-accent font-semibold text-accent-foreground hover:bg-accent hover:text-accent-foreground max-md:bg-accent')}
              >
                <span>{s.label}</span>
              </Link>
            )
          })}
          <Link href="/events" className={cn(linkClass, 'md:mt-3 md:rounded-none md:border-t md:border-border md:pt-3.5')}>
            <span>← All events</span>
          </Link>
        </nav>

        <div className="min-w-0">{content}</div>
      </div>
    </EventRoleProvider>
  )
}
