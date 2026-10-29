'use client'

import { useMemo, useState } from 'react'
import { Check, QrCode, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Guest = { id: number; name: string; role: string; company: string; type: 'VIP' | 'Speaker' | 'Delegate'; checkedIn: boolean }

const SAMPLE: Guest[] = [
  { id: 1, name: 'Aisha Rahman', role: 'Head of Security', company: 'Northwind Bank', type: 'VIP', checkedIn: true },
  { id: 2, name: 'Daniel Okafor', role: 'CTO', company: 'Brightline Labs', type: 'Speaker', checkedIn: false },
  { id: 3, name: 'Meera Iyer', role: 'Events Manager', company: 'Coastal Group', type: 'Delegate', checkedIn: true },
  { id: 4, name: 'Lucas Moreau', role: 'Product Lead', company: 'Atlas Retail', type: 'Delegate', checkedIn: false },
  { id: 5, name: 'Sara Haddad', role: 'Founder', company: 'Oasis Ventures', type: 'VIP', checkedIn: false },
]

// One class per possible count, since SAMPLE always has five guests
const PROGRESS_WIDTH = ['w-0', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full']

const TYPE_STYLE: Record<Guest['type'], string> = {
  VIP: 'bg-primary text-primary-foreground',
  Speaker: 'bg-accent text-accent-foreground dark:text-brand',
  Delegate: 'bg-secondary text-secondary-foreground border border-border',
}

export default function CheckinDemo() {
  const [guests, setGuests] = useState(SAMPLE)
  const [query, setQuery] = useState('')
  const [badgeId, setBadgeId] = useState(1)
  const [pulse, setPulse] = useState(0)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? guests.filter((g) => `${g.name} ${g.company}`.toLowerCase().includes(q)) : guests
  }, [guests, query])

  const arrived = guests.filter((g) => g.checkedIn).length
  const badge = guests.find((g) => g.id === badgeId) ?? guests[0]!
  const allIn = arrived === guests.length

  const toggle = (id: number) => {
    setGuests((list) => list.map((g) => (g.id === id ? { ...g, checkedIn: !g.checkedIn } : g)))
    setBadgeId(id)
    setPulse((p) => p + 1)
  }

  const scanNext = () => {
    const next = guests.find((g) => !g.checkedIn)
    if (next) toggle(next.id)
  }

  const reset = () => {
    setGuests(SAMPLE)
    setBadgeId(1)
    setQuery('')
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <p className="text-sm font-semibold">Sample event: Product Summit 2026</p>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">Demo data, nothing is saved</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-4 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or company"
                aria-label="Search sample guests"
                className="pl-9"
              />
            </div>
            {allIn ? (
              <Button variant="outline" onClick={reset}>
                <RotateCcw /> Reset demo
              </Button>
            ) : (
              <Button onClick={scanNext}>
                <QrCode /> Simulate QR scan
              </Button>
            )}
          </div>

          <ul className="divide-y divide-border rounded-xl border border-border">
            {visible.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.role} · {g.company}
                  </p>
                </div>
                <span className={cn('hidden rounded-md px-2 py-0.5 text-[11px] font-semibold sm:inline', TYPE_STYLE[g.type])}>{g.type}</span>
                <Button
                  size="sm"
                  variant={g.checkedIn ? 'secondary' : 'outline'}
                  onClick={() => toggle(g.id)}
                  aria-pressed={g.checkedIn}
                  aria-label={`${g.checkedIn ? 'Undo check-in for' : 'Check in'} ${g.name}`}
                  className={cn('w-28 shrink-0', g.checkedIn && 'text-primary dark:text-brand')}
                >
                  {g.checkedIn ? (
                    <>
                      <Check /> Checked in
                    </>
                  ) : (
                    'Check in'
                  )}
                </Button>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No sample guest matches “{query}”.</li>}
          </ul>
        </div>

        <div className="flex flex-col gap-5 bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Guest pass preview</p>

          <div
            key={pulse}
            className="animate-in zoom-in-95 fade-in rounded-2xl border border-border bg-card p-5 shadow-md duration-300 motion-reduce:animate-none"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-brand">Product Summit 2026</p>
                <p className="text-[11px] text-muted-foreground">Dubai · 18 Nov 2026</p>
              </div>
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', TYPE_STYLE[badge.type])}>{badge.type}</span>
            </div>
            <div className="my-5 text-center">
              <p className="text-2xl font-bold leading-tight">{badge.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{badge.role}</p>
              <p className="text-sm font-semibold text-primary dark:text-brand">{badge.company}</p>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-border pt-4">
              <span className={cn('text-xs font-semibold', badge.checkedIn ? 'text-primary dark:text-brand' : 'text-muted-foreground')} aria-live="polite">
                {badge.checkedIn ? '✓ Checked in' : 'Not checked in yet'}
              </span>
              <span className="flex size-10 items-center justify-center rounded-lg bg-neutral-50">
                <QrCode className="size-8 text-neutral-900" strokeWidth={1.5} aria-hidden="true" />
              </span>
            </div>
          </div>

          <div className="mt-auto space-y-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Checked in</span>
              <span className="font-semibold text-primary dark:text-brand">
                {arrived} / {guests.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={guests.length} aria-valuenow={arrived} aria-label="Sample guests checked in">
              <div className={cn('h-full rounded-full bg-primary transition-[width] duration-500', PROGRESS_WIDTH[arrived])} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
