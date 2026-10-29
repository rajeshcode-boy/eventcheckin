'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface EventInfo {
  name: string
  location: string
  event_date: string
  status: string
}

interface Registration {
  id: string
  full_name: string | null
  company: string | null
  registration_status: string
  badge_collected_at: string | null
}

interface Checkin {
  registration_id: string
  checked_in_at: string
}

const CANCELLED = ['cancelled', 'rejected']

function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

// Post-event summary: attendance, no-shows, badges and arrival peaks, with a guest list download
export default function ReportPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [eventRes, regRes, checkinRes] = await Promise.all([
          supabase.from('events').select('name, location, event_date, status').eq('id', eventUuid).single(),
          supabase.from('registrations').select('id, full_name, company, registration_status, badge_collected_at').eq('event_id', eventUuid),
          supabase.from('checkins').select('registration_id, checked_in_at').eq('event_id', eventUuid),
        ])
        if (eventRes.error || !eventRes.data) {
          setError('Event not found')
          return
        }
        if (regRes.error || checkinRes.error) {
          setError('Could not load the report. Try again.')
          return
        }
        setEvent(eventRes.data as EventInfo)
        setRegistrations((regRes.data ?? []) as Registration[])
        setCheckins((checkinRes.data ?? []) as Checkin[])
      } catch {
        setError('Could not load the report. Try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventUuid])

  const summary = useMemo(() => {
    const active = registrations.filter((r) => !CANCELLED.includes(r.registration_status))
    const checkedInIds = new Set(checkins.map((c) => c.registration_id))
    const attended = active.filter((r) => checkedInIds.has(r.id))
    const noShows = active.filter((r) => !checkedInIds.has(r.id))
    const badgesPrinted = registrations.filter((r) => r.badge_collected_at).length

    // Arrivals per hour, so organisers can see when the rush was
    const perHour = new Map<number, number>()
    for (const c of checkins) {
      const hour = new Date(c.checked_in_at).getHours()
      perHour.set(hour, (perHour.get(hour) ?? 0) + 1)
    }
    const peak = [...perHour.entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      registered: active.length,
      attended: attended.length,
      noShows,
      rate: active.length ? Math.round((attended.length / active.length) * 100) : 0,
      badgesPrinted,
      peak,
    }
  }, [registrations, checkins])

  const downloadGuestList = () => {
    const checkedInIds = new Set(checkins.map((c) => c.registration_id))
    const header = ['Name', 'Company', 'Status', 'Checked in', 'Badge collected']
    const rows = registrations.map((r) => [
      r.full_name ?? '',
      r.company ?? '',
      r.registration_status,
      checkedInIds.has(r.id) ? 'Yes' : 'No',
      r.badge_collected_at ? 'Yes' : 'No',
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${event?.name ?? 'event'}-report.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p>Loading report...</p>
  if (error || !event) return <Alert variant="error">{error || 'Event not found'}</Alert>

  const card = 'rounded-xl border border-border bg-card px-4.5 py-4'
  const label = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold">Event report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.name} · {new Date(event.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>Print</Button>
          <Button type="button" onClick={downloadGuestList} disabled={registrations.length === 0}>Download guest list (CSV)</Button>
        </div>
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <div className={card}>
          <p className={label}>Registered</p>
          <p className="text-2xl font-bold">{summary.registered}</p>
        </div>
        <div className={card}>
          <p className={label}>Attended</p>
          <p className="text-2xl font-bold">{summary.attended}</p>
          <p className="text-[13px] text-muted-foreground">{summary.rate}% of registered</p>
        </div>
        <div className={card}>
          <p className={label}>No-shows</p>
          <p className="text-2xl font-bold">{summary.noShows.length}</p>
        </div>
        <div className={card}>
          <p className={label}>Badges collected</p>
          <p className="text-2xl font-bold">{summary.badgesPrinted}</p>
        </div>
        <div className={card}>
          <p className={label}>Busiest hour</p>
          <p className="text-lg font-bold">{summary.peak ? `${formatHour(summary.peak[0])} · ${summary.peak[1]} arrivals` : 'No check-ins yet'}</p>
        </div>
      </section>

      <section className={card}>
        <h3 className="mb-2.5 text-base font-semibold">No-shows ({summary.noShows.length})</h3>
        {summary.noShows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone registered has checked in.</p>
        ) : (
          <ul className="grid gap-1.5 text-sm">
            {summary.noShows.map((r) => (
              <li key={r.id}>
                {r.full_name || 'Unnamed guest'}
                {r.company && <span className="text-muted-foreground"> · {r.company}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
