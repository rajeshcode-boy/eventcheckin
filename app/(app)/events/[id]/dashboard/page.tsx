'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/components/ConfirmDialog'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatTime } from '@/lib/time'
import ExportButtons from './ExportButtons'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EventInfo {
  id: string
  event_id: string
  name: string
  location: string
  status: 'upcoming' | 'live' | 'closed'
}

interface Registration {
  id: string
  source: 'import' | 'manual' | 'walkin'
  full_name: string
  designation: string | null
  company: string | null
}

interface Checkin {
  id: string
  registration_id: string
  checked_in_at: string
  method: string
}

const FEED_SIZE = 20

export default function DashboardPage() {
  const { confirm, dialog } = useConfirm()
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadData = useCallback(async () => {
    const [eventRes, regRes, checkinRes] = await Promise.all([
      supabase.from('events').select('id, event_id, name, location, status').eq('id', eventUuid).single(),
      supabase.from('registrations').select('id, source, full_name, designation, company').eq('event_id', eventUuid),
      supabase
        .from('checkins')
        .select('id, registration_id, checked_in_at, method')
        .eq('event_id', eventUuid)
        .order('checked_in_at', { ascending: false }),
    ])

    if (eventRes.error || !eventRes.data) {
      setError('Event not found')
      return
    }
    if (regRes.error || checkinRes.error) {
      setError('Could not load check-in data. Use Refresh to try again.')
      return
    }
    setError('')
    setEvent(eventRes.data as EventInfo)
    setRegistrations((regRes.data ?? []) as Registration[])
    setCheckins((checkinRes.data ?? []) as Checkin[])
    setLastUpdated(new Date().toISOString())
  }, [eventUuid])

  // Bursts of changes (e.g. an import) trigger one reload
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(loadData, 300)
  }, [loadData])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel(`dashboard-${eventUuid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: `event_id=eq.${eventUuid}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` }, scheduleReload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventUuid}` }, scheduleReload)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      supabase.removeChannel(channel)
    }
  }, [eventUuid, loadData, scheduleReload])

  const stats = useMemo(() => {
    const checkedIn = new Set(checkins.map((c) => c.registration_id))
    const preRegistered = registrations.filter((r) => r.source !== 'walkin')
    const arrived = preRegistered.filter((r) => checkedIn.has(r.id)).length
    return {
      total: registrations.length,
      preRegistered: preRegistered.length,
      arrived,
      walkins: registrations.filter((r) => r.source === 'walkin').length,
      notArrived: preRegistered.length - arrived,
      attendance: preRegistered.length ? Math.round((arrived / preRegistered.length) * 100) : 0,
    }
  }, [registrations, checkins])

  const feed = useMemo(() => {
    const byId = new Map(registrations.map((r) => [r.id, r]))
    return checkins.slice(0, FEED_SIZE).map((c) => ({ ...c, person: byId.get(c.registration_id) }))
  }, [registrations, checkins])

  const setStatus = async (status: EventInfo['status']) => {
    if (!event) return
    if (status === 'closed') {
      const ok = await confirm({
        title: `Close check-in for ${event.name}?`,
        description: `${stats.notArrived} registered guest(s) who haven't arrived will be marked as no-shows. No new check-ins or walk-ins will be accepted until you reopen.`,
        confirmLabel: 'Close check-in',
        destructive: true,
      })
      if (!ok) return
    }
    setBusy(true)
    setError('')
    const { data, error: updateError } = await supabase
      .from('events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', event.id)
      .select('id')
    setBusy(false)
    if (updateError || !data?.length) {
      setError('Could not change check-in status. Only admins can open or close check-in.')
      return
    }
    loadData()
  }

  if (!event) {
    return error ? (
      <div>
        <p className="alert-error">{error}</p>
        <Link href="/events" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
          Back to events
        </Link>
      </div>
    ) : (
      <p>Loading dashboard...</p>
    )
  }

  const closed = event.status === 'closed'

  return (
    <>
    {dialog}
    <div className="max-w-[1100px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-[28px] font-bold">Live Dashboard</h1>
          <p className="text-base text-muted-foreground">
            {event.name} • <span className="font-mono">{event.event_id}</span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn('size-2.5 rounded-full', live ? 'bg-(--color-live)' : 'bg-amber-500')}
            />
            {live ? 'Live updates on' : 'Live updates off — use Refresh'}
            {lastUpdated && ` • Updated ${formatTime(lastUpdated)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={loadData} disabled={busy}>
            Refresh
          </Button>
          {closed ? (
            <Button onClick={() => setStatus('live')} disabled={busy}>
              Reopen check-in
            </Button>
          ) : (
            <Button variant="outline" className="border-destructive text-destructive" onClick={() => setStatus('closed')} disabled={busy}>
              Close check-in
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <Alert variant={closed ? 'error' : 'success'} className="mb-6">
        {closed
          ? 'Check-in is closed. Guests who had not arrived are counted as no-shows. Reopen to accept check-ins again.'
          : 'Check-in is open. New check-ins and walk-ins appear here as they happen.'}
      </Alert>

      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard label="Total registered" value={stats.total} note={`${stats.preRegistered} pre-registered`} />
        <StatCard label="Checked in" value={stats.arrived} note={`${stats.attendance}% of pre-registered`} accent="border-t-primary" />
        <StatCard label="Walk-ins" value={stats.walkins} accent="border-t-amber-500" />
        {closed ? (
          <StatCard label="No-shows" value={stats.notArrived} accent="border-t-destructive" />
        ) : (
          <StatCard label="Not yet arrived" value={stats.notArrived} accent="border-t-muted-foreground" />
        )}
      </div>

      <ExportButtons event={event} />

      <h2 className="mb-3 text-xl font-semibold">Latest check-ins</h2>
      {feed.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
          No check-ins yet.
        </div>
      ) : (
        <ul className="rounded-md border border-border">
          {feed.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-4 border-t border-border px-4 py-3 first:border-t-0">
              <span className="min-w-[110px] text-sm text-muted-foreground">
                {formatTime(c.checked_in_at)}
              </span>
              <span className="font-semibold">{c.person?.full_name ?? 'Deleted attendee'}</span>
              <span className="flex-1 text-sm text-muted-foreground">
                {[c.person?.designation, c.person?.company].filter(Boolean).join(' • ')}
              </span>
              {c.method === 'walkin' && (
                <span className="rounded-full border border-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-600">
                  Walk-in
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  )
}

function StatCard({ label, value, note, accent }: { label: string; value: number; note?: string; accent?: string }) {
  return (
    <div className={cn('rounded-md border border-border p-4', accent && 'border-t-4', accent)}>
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
      <p className="text-[28px] font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
