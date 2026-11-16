'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { EventRoleProvider } from '@/components/EventRoleContext'
import { RoleBadge } from '@/components/RoleBadge'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'
import { fetchEventRole } from '@/lib/eventRole'
import { canOpenPath, ROLE_LABELS, sectionsForRole, type EventRole } from '@/lib/permissions'

const LIFECYCLE_GROUPS = [
  {
    title: 'EVENT DAY',
    keys: ['desk'],
  },
  {
    title: 'PREPARE',
    keys: ['overview', 'guests', 'speakers', 'sponsors', 'badge-design'],
  },
  {
    title: 'DEBRIEF & SETTINGS',
    keys: ['report', 'team', 'edit'],
  },
]

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.id as string
  const base = `/events/${eventId}`
  const [role, setRole] = useState<EventRole | null>(null)
  const [eventName, setEventName] = useState<string>('')
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

    supabase
      .from('events')
      .select('name')
      .eq('id', eventId)
      .single()
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.name) {
          setEventName(data.name)
        }
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  const sections = sectionsForRole(role).map((s) => ({ ...s, href: base + s.href, exact: s.key === 'overview' }))

  const isActive = (s: { href: string; exact?: boolean }) =>
    s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(s.href + '/')

  const panel = 'rounded-xl border border-border bg-card p-5'
  const linkClass =
    'flex min-h-10 items-center justify-between rounded-[10px] px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-secondary hover:text-foreground max-md:border max-md:border-border max-md:bg-card md:whitespace-normal transition-colors'

  let content: React.ReactNode = children
  if (state === 'loading') content = <p>Loading...</p>
  else if (state === 'error')
    content = (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        Could not check your access to this event. Reload to try again.
      </p>
    )
  else if (!role) {
    content = (
      <div className={panel}>
        <h1 className="text-xl font-semibold">You do not have access to this event</h1>
        <p className="mt-1.5 text-muted-foreground">Ask an event owner or manager to add you to the team.</p>
        <Button variant="outline" className="mt-3" render={<Link href="/events" />} nativeButton={false}>
          Back to events
        </Button>
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
      <div className="grid items-start gap-7 max-md:gap-4 md:grid-cols-[210px_minmax(0,1fr)]">
        <nav
          aria-label="Event sections"
          className="flex gap-1.5 overflow-x-auto pb-1 md:sticky md:top-[84px] md:flex-col md:gap-0.5 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {/* Back to All Events at the very top */}
          <Link
            href="/events"
            className={cn(
              linkClass,
              'font-semibold text-foreground/80 hover:text-foreground md:mb-2 md:rounded-lg md:border md:border-border/70 md:bg-muted/40 md:py-1.5'
            )}
          >
            <span className="flex items-center gap-1.5">
              <span>←</span>
              <span>All events</span>
            </span>
          </Link>

          {role && (
            <div className="shrink-0 px-3 pb-2 max-md:flex max-md:items-center max-md:px-0 max-md:pb-0">
              <RoleBadge role={role} />
            </div>
          )}

          {LIFECYCLE_GROUPS.map((group) => {
            const groupSections = sections.filter((s) => group.keys.includes(s.key))
            if (groupSections.length === 0) return null
            return (
              <div key={group.title} className="md:mt-3 md:first:mt-0 flex gap-1.5 md:flex-col md:gap-0.5">
                <p className="hidden px-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 md:block">
                  {group.title}
                </p>
                {groupSections.map((s) => {
                  const active = isActive(s)
                  return (
                    <Link
                      key={s.key}
                      href={s.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        linkClass,
                        active &&
                          'bg-accent font-semibold text-accent-foreground hover:bg-accent hover:text-accent-foreground max-md:bg-accent'
                      )}
                    >
                      <span>{s.label}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="min-w-0">
          {state === 'ready' && role && (
            <div className="mb-4 flex items-center justify-between">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link href="/events" className="font-medium hover:text-foreground transition-colors">
                      Events
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {pathname === base ? (
                      <BreadcrumbPage className="max-w-[220px] truncate font-semibold sm:max-w-[340px]">
                        {eventName || 'Event'}
                      </BreadcrumbPage>
                    ) : (
                      <Link
                        href={base}
                        className="max-w-[220px] truncate font-medium hover:text-foreground transition-colors sm:max-w-[340px]"
                      >
                        {eventName || 'Event'}
                      </Link>
                    )}
                  </BreadcrumbItem>
                  {pathname !== base && (() => {
                    const active = sections.find((s) => isActive(s))
                    return active && active.key !== 'overview' ? (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage className="font-semibold">{active.label}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    ) : null
                  })()}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          )}
          {content}
        </div>
      </div>
    </EventRoleProvider>
  )
}
