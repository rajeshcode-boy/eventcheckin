'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearAll, dequeue, enqueue, getGuests, getQueue, putGuest, replaceGuests } from '@/lib/kiosk/db'
import { matchScan, searchGuests } from '@/lib/kiosk/search'
import { clearSession, loadSession, saveSession } from '@/lib/kiosk/session'
import { describeConflict, flushQueue } from '@/lib/kiosk/sync'
import type { KioskGuest, KioskSession, QueuedScan, SyncResult } from '@/lib/kiosk/types'
import { useConfirm } from '@/components/ConfirmDialog'

// Public tablet page (no organiser login). Paired with a 6-digit code; everything after that is
// authorised by the kiosk token. Works offline: scans go into IndexedDB and upload when Wi-Fi returns.

type Toast = { kind: 'ok' | 'warn' | 'err'; text: string; scanId?: string; guestId?: string }

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''

async function api<T>(session: KioskSession, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1/kiosks/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('offline')
  }
  if (res.status === 401) throw new Error('revoked')
  if (!res.ok) throw new Error('offline')
  return res.json() as Promise<T>
}

const big = { minHeight: 64, fontSize: 20, borderRadius: 'var(--radius-md)', border: '2px solid var(--color-primary)', cursor: 'pointer', padding: '0 24px' } as const

export default function KioskPage() {
  const [session, setSession] = useState<KioskSession | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(loadSession())
    setReady(true)
  }, [])

  if (!ready) return null
  if (!session) return <Pairing onPaired={(s) => { saveSession(s); setSession(s) }} />
  return <Desk session={session} onUnpair={async () => { clearSession(); await clearAll().catch(() => {}); setSession(null) }} />
}

function Pairing({ onPaired }: { onPaired: (s: KioskSession) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    if (value.length !== 6 || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/v1/kiosks/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not pair.')
      onPaired({ token: data.token, kioskCode: data.kioskCode, label: data.label, eventName: data.eventName })
    } catch (e) {
      setError(e instanceof TypeError ? 'No connection. Pairing needs Wi-Fi.' : (e as Error).message)
      setCode('')
    }
    setBusy(false)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--color-neutral-light)' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 32, display: 'grid', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: 'var(--color-text-primary)' }}>Pair this tablet</h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 18 }}>
          On the organiser&apos;s screen, open Pickup, choose Pair a kiosk, and type the 6-digit code here.
        </p>
        <input
          id="pairCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          aria-label="6-digit pairing code"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(v)
            if (v.length === 6) submit(v)
          }}
          placeholder="000000"
          style={{ fontSize: 44, letterSpacing: '0.4em', textAlign: 'center', height: 84, border: '2px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
        />
        {error && <div role="alert" style={{ color: 'var(--color-error-red)', fontSize: 18 }}>{error}</div>}
        <button disabled={code.length !== 6 || busy} onClick={() => submit(code)} style={{ ...big, background: 'var(--color-primary)', color: '#fff', opacity: code.length === 6 && !busy ? 1 : 0.5 }}>
          {busy ? 'Pairing…' : 'Pair'}
        </button>
      </div>
    </main>
  )
}

function Desk({ session, onUnpair }: { session: KioskSession; onUnpair: () => void }) {
  const { confirm, dialog } = useConfirm()
  const [guests, setGuests] = useState<KioskGuest[]>([])
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(true)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [revoked, setRevoked] = useState(false)
  const channel = useRef<RealtimeChannel | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const guestsRef = useRef<KioskGuest[]>([])
  guestsRef.current = guests
  const flushing = useRef(false)
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window

  const results = useMemo(() => searchGuests(guests, query), [guests, query])
  const recent = useMemo(
    () => guests.filter((g) => g.checked_in_at).sort((a, b) => b.checked_in_at!.localeCompare(a.checked_in_at!)).slice(0, 40),
    [guests]
  )

  const refreshPending = useCallback(async () => setPending((await getQueue()).length), [])

  // Pull the latest guest list. Scans still waiting in the queue are laid over it so they don't flicker back to "not arrived".
  const refreshRoster = useCallback(async () => {
    try {
      const data = await api<{ guests: KioskGuest[]; channel_key: string }>(session, 'roster')
      const queued = await getQueue()
      const mine = new Map(queued.map((q) => [q.registration_uuid, q]))
      const merged = data.guests.map((g) =>
        !g.checked_in_at && mine.has(g.id) ? { ...g, checked_in_at: mine.get(g.id)!.scanned_at, checked_in_by: session.kioskCode } : g
      )
      await replaceGuests(merged)
      setGuests(merged)
      setOnline(true)
      if (!channel.current) {
        const ch = supabase.channel(`kiosk-${data.channel_key}`)
        ch.on('broadcast', { event: 'checkin' }, () => refreshRosterRef.current()).subscribe()
        channel.current = ch
      }
    } catch (e) {
      if ((e as Error).message === 'revoked') setRevoked(true)
      else setOnline(false)
    }
  }, [session])
  const refreshRosterRef = useRef(refreshRoster)
  refreshRosterRef.current = refreshRoster

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    setSyncing(true)
    const outcome = await flushQueue({
      getQueue,
      dequeue,
      post: async (scans) => (await api<{ results: SyncResult[] }>(session, 'sync-batch', { scans })).results,
    })
    flushing.current = false
    setSyncing(false)
    await refreshPending()
    if (!outcome.ok) {
      if (outcome.reason === 'revoked') setRevoked(true)
      else setOnline(false)
    } else setOnline(true)

    // Someone else got there first: tell the staff member, whose local copy is now wrong
    const conflict = outcome.results.find((r) => r.status === 'already_checked_in')
    if (conflict) {
      setToast({ kind: 'err', text: `${conflict.full_name}: ${describeConflict(conflict)}` })
    }
    if (outcome.results.some((r) => r.status === 'checked_in')) {
      channel.current?.send({ type: 'broadcast', event: 'checkin', payload: {} })
    }
    if (outcome.results.length) await refreshRoster()
  }, [session, refreshPending, refreshRoster])

  // Start-up: show the cached list immediately, then refresh from the server
  useEffect(() => {
    getGuests().then(setGuests).catch(() => {})
    refreshPending()
    refreshRoster().then(flush)
    const onOnline = () => { refreshRoster().then(flush) }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = setInterval(() => { refreshRosterRef.current() }, 60000)
    const retry = setInterval(() => { getQueue().then((q) => { if (q.length) flush() }) }, 15000)
    inputRef.current?.focus()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(timer)
      clearInterval(retry)
      if (channel.current) supabase.removeChannel(channel.current)
      channel.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkIn = async (g: KioskGuest, method: 'qr' | 'manual') => {
    setQuery('')
    inputRef.current?.focus()
    if (g.checked_in_at) {
      setToast({ kind: 'warn', text: `${g.full_name}: ${describeConflict({ checked_in_at: g.checked_in_at, by_kiosk: g.checked_in_by ?? undefined })}` })
      return
    }
    const scan: QueuedScan = { scan_id: crypto.randomUUID(), registration_uuid: g.id, scanned_at: new Date().toISOString(), method, full_name: g.full_name }
    const updated = { ...g, checked_in_at: scan.scanned_at, checked_in_by: session.kioskCode }
    // Save locally first so the check-in survives a dropped connection or a reload
    await enqueue(scan)
    await putGuest(updated)
    setGuests((prev) => prev.map((x) => (x.id === g.id ? updated : x)))
    setToast({ kind: 'ok', text: `${g.full_name} checked in`, scanId: scan.scan_id, guestId: g.id })
    await refreshPending()
    flush()
  }

  const undo = async (t: Toast) => {
    if (!t.scanId || !t.guestId) return
    const g = guestsRef.current.find((x) => x.id === t.guestId)
    if (!g) return
    const queued = (await getQueue()).some((q) => q.scan_id === t.scanId)
    if (!queued) {
      try {
        const r = await api<{ undone: boolean }>(session, 'undo', { scan_id: t.scanId })
        if (!r.undone) { setToast({ kind: 'err', text: 'Could not undo; refreshing the list.' }); return refreshRoster() }
        channel.current?.send({ type: 'broadcast', event: 'checkin', payload: {} })
      } catch {
        setToast({ kind: 'err', text: 'Cannot undo while offline. Try again when connected.', scanId: t.scanId, guestId: t.guestId })
        return
      }
    } else await dequeue(t.scanId)
    const reverted = { ...g, checked_in_at: null, checked_in_by: null }
    await putGuest(reverted)
    setGuests((prev) => prev.map((x) => (x.id === g.id ? reverted : x)))
    await refreshPending()
    setToast({ kind: 'warn', text: `Undone: ${g.full_name} is not checked in` })
  }

  const submit = async (raw: string) => {
    const scanned = await matchScan(guestsRef.current, raw)
    if (scanned) return checkIn(scanned, 'qr')
    const found = searchGuests(guestsRef.current, raw, 2)
    if (found.length === 1) return checkIn(found[0]!, 'manual')
    setToast({ kind: 'err', text: found.length ? 'Several guests match. Tap one below.' : `No guest found for "${raw.trim()}"` })
  }

  const startScan = async () => {
    if (!canScan) return
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).catch(() => null)
    if (!stream || !videoRef.current) return setToast({ kind: 'err', text: "Couldn't open the camera. Use search instead." })
    setScanning(true)
    const video = videoRef.current
    video.srcObject = stream
    await video.play()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
    let last = ''
    let lastAt = 0
    const loop = async () => {
      if (!video.srcObject) return
      const codes = await detector.detect(video).catch(() => [])
      const value: string | undefined = codes[0]?.rawValue
      if (value && (value !== last || Date.now() - lastAt > 4000)) {
        last = value
        lastAt = Date.now()
        await submit(value)
      }
      setTimeout(loop, 400)
    }
    loop()
  }
  const stopScan = () => {
    const v = videoRef.current
    ;(v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop())
    if (v) v.srcObject = null
    setScanning(false)
  }
  useEffect(() => stopScan, [])

  if (revoked) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, display: 'grid', gap: 16, textAlign: 'center' }}>
          <h1 style={{ margin: 0, color: 'var(--color-text-primary)' }}>This kiosk was removed</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 18 }}>An organiser revoked it. Scans not yet uploaded stay on this tablet until it is paired again.</p>
          <button onClick={onUnpair} style={{ ...big, background: 'var(--color-primary)', color: '#fff' }}>Pair again</button>
        </div>
      </main>
    )
  }

  const tone = { ok: 'var(--color-live)', warn: 'var(--color-amber-warning)', err: 'var(--color-error-red)' }

  return (
    <>
    {dialog}
    <main style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr', background: 'var(--color-neutral-light)', color: 'var(--color-text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 22 }}>{session.eventName}</div>
          <div style={{ color: 'var(--color-text-secondary)' }}>{session.label} · {session.kioskCode}</div>
        </div>
        <span role="status" style={{ padding: '8px 14px', borderRadius: 999, fontWeight: 600, background: online ? 'var(--color-live-soft)' : 'var(--color-amber-warning)', color: online ? 'var(--color-live)' : '#000' }}>
          {online ? (syncing ? 'Syncing…' : 'Online') : 'Offline · scans are saved'}
        </span>
        {pending > 0 && <span style={{ fontWeight: 600 }}>{pending} waiting to upload</span>}
        <button onClick={async () => { if (await confirm({ title: 'Unpair this tablet?', description: 'Scans not yet uploaded will be lost.', confirmLabel: 'Unpair', destructive: true })) onUnpair() }} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 16, minHeight: 44 }}>Unpair</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 24, padding: 24, alignItems: 'start' }}>
        <section style={{ display: 'grid', gap: 16 }}>
          {toast && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 'var(--radius-md)', background: tone[toast.kind], color: toast.kind === 'warn' ? '#000' : '#fff', fontSize: 22, fontWeight: 600 }}>
              <span style={{ flex: 1 }}>{toast.text}</span>
              {toast.scanId && toast.kind === 'ok' && (
                <button onClick={() => undo(toast)} style={{ ...big, minHeight: 52, fontSize: 18, background: '#fff', color: '#000', border: 'none' }}>Undo</button>
              )}
              <button aria-label="Dismiss" onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', fontSize: 28, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>×</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <input
              id="kioskSearch"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) submit(query) }}
              placeholder="Name, email or confirmation code"
              autoComplete="off"
              style={{ flex: 1, minHeight: 64, fontSize: 22, padding: '0 20px', border: '2px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
            />
            {canScan && (
              <button onClick={scanning ? stopScan : startScan} style={{ ...big, background: 'var(--color-surface)', color: 'var(--color-primary)' }}>{scanning ? 'Stop camera' : 'Scan QR'}</button>
            )}
          </div>

          <video ref={videoRef} muted playsInline style={{ display: scanning ? 'block' : 'none', width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 'var(--radius-md)', background: '#000' }} />

          <div style={{ display: 'grid', gap: 10 }}>
            {results.map((g) => (
              <button key={g.id} onClick={() => checkIn(g, 'manual')} style={{ display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', minHeight: 76, padding: '12px 20px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '2px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 22, fontWeight: 700 }}>{g.full_name}</span>
                  <span style={{ display: 'block', fontSize: 16, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[g.company, g.email, g.registration_id].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span style={{ fontWeight: 700, fontSize: 18, color: g.checked_in_at ? 'var(--color-amber-warning)' : 'var(--color-live)' }}>
                  {g.checked_in_at ? `In ${time(g.checked_in_at)}` : 'Check in'}
                </span>
              </button>
            ))}
            {query.trim() && results.length === 0 && <div style={{ fontSize: 20, color: 'var(--color-text-secondary)' }}>No guest matches. Check the spelling or try the email.</div>}
            {!query.trim() && guests.length === 0 && <div style={{ fontSize: 20, color: 'var(--color-text-secondary)' }}>{online ? 'Loading the guest list…' : 'No guest list on this tablet yet. Connect to Wi-Fi once to download it.'}</div>}
          </div>
        </section>

        <aside style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16, display: 'grid', gap: 8, maxHeight: 'calc(100vh - 140px)', gridTemplateRows: 'auto 1fr' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Recent pickups <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>({guests.filter((g) => g.checked_in_at).length}/{guests.length})</span></h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', display: 'grid', gap: 6, alignContent: 'start' }}>
            {recent.length === 0 && <li style={{ color: 'var(--color-text-secondary)' }}>No one has checked in yet.</li>}
            {recent.map((g) => (
              <li key={g.id} style={{ padding: '10px 12px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block' }}>{g.full_name}</b>
                  <small style={{ color: 'var(--color-text-secondary)' }}>{g.checked_in_by ?? 'desk'}</small>
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time(g.checked_in_at)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
    </>
  )
}
