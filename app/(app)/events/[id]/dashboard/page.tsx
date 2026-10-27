'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatTime } from '@/lib/time'
import ExportButtons from './ExportButtons'

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
      const ok = confirm(
        `Close check-in for ${event.name}?\n\n${stats.notArrived} registered guest(s) who haven't arrived will be marked as no-shows. ` +
          'No new check-ins or walk-ins will be accepted until you reopen.'
      )
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
    <div style={{ maxWidth: '1100px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Live Dashboard</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            {event.name} • <span style={{ fontFamily: 'monospace' }}>{event.event_id}</span>
          </p>
          <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              aria-hidden="true"
              style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: live ? 'var(--color-live)' : 'var(--color-amber-warning)' }}
            />
            {live ? 'Live updates on' : 'Live updates off — use Refresh'}
            {lastUpdated && ` • Updated ${formatTime(lastUpdated)}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={loadData} disabled={busy}>
            Refresh
          </button>
          {closed ? (
            <button className="btn-primary" onClick={() => setStatus('live')} disabled={busy}>
              Reopen check-in
            </button>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => setStatus('closed')}
              disabled={busy}
              style={{ color: 'var(--color-error-red)', borderColor: 'var(--color-error-red)' }}
            >
              Close check-in
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className={closed ? 'alert-error' : 'alert-success'} style={{ marginBottom: '24px', fontSize: '14px' }}>
        {closed
          ? 'Check-in is closed. Guests who had not arrived are counted as no-shows. Reopen to accept check-ins again.'
          : 'Check-in is open. New check-ins and walk-ins appear here as they happen.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total registered" value={stats.total} note={`${stats.preRegistered} pre-registered`} />
        <StatCard label="Checked in" value={stats.arrived} note={`${stats.attendance}% of pre-registered`} color="var(--color-primary)" />
        <StatCard label="Walk-ins" value={stats.walkins} color="var(--color-amber-warning)" />
        {closed ? (
          <StatCard label="No-shows" value={stats.notArrived} color="var(--color-error-red)" />
        ) : (
          <StatCard label="Not yet arrived" value={stats.notArrived} color="var(--color-text-secondary)" />
        )}
      </div>

      <ExportButtons event={event} />

      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Latest check-ins</h2>
      {feed.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)' }}>
          No check-ins yet.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          {feed.map((c, i) => (
            <li
              key={c.id}
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'baseline',
                padding: '12px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', minWidth: '110px' }}>
                {formatTime(c.checked_in_at)}
              </span>
              <span style={{ fontWeight: 600 }}>{c.person?.full_name ?? 'Deleted attendee'}</span>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', flex: 1 }}>
                {[c.person?.designation, c.person?.company].filter(Boolean).join(' • ')}
              </span>
              {c.method === 'walkin' && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-amber-warning)', border: '1px solid var(--color-amber-warning)', borderRadius: '999px', padding: '2px 8px' }}>
                  Walk-in
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatCard({ label, value, note, color }: { label: string; value: number; note?: string; color?: string }) {
  return (
    <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px', borderTop: color ? `4px solid ${color}` : undefined }}>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '28px', fontWeight: 'bold' }}>{value}</p>
      {note && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{note}</p>}
    </div>
  )
}
