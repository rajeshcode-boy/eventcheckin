'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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

// Large touch targets: tablets are used standing up, often with one hand
const bigButton = 'h-16 rounded-xl px-6 text-xl'

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
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="grid w-full max-w-[480px] gap-4 rounded-2xl border border-border bg-card p-8">
        <h1 className="text-[28px] font-bold text-foreground">Pair this tablet</h1>
        <p className="text-lg text-muted-foreground">
          On the organiser&apos;s screen, open Desk, choose the Devices tab, and type the 6-digit code here.
        </p>
        <Input
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
          className="h-[84px] border-2 text-center text-[44px] tracking-[0.4em] md:text-[44px]"
        />
        {error && <div role="alert" className="text-lg text-destructive">{error}</div>}
        <Button className={bigButton} disabled={code.length !== 6 || busy} onClick={() => submit(code)}>
          {busy ? 'Pairing…' : 'Pair'}
        </Button>
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
      <main className="grid min-h-screen place-items-center p-6">
        <div className="grid max-w-[480px] gap-4 text-center">
          <h1 className="text-2xl font-bold text-foreground">This kiosk was removed</h1>
          <p className="text-lg text-muted-foreground">An organiser revoked it. Scans not yet uploaded stay on this tablet until it is paired again.</p>
          <Button className={bigButton} onClick={onUnpair}>Pair again</Button>
        </div>
      </main>
    )
  }

  const tone = { ok: 'bg-(--color-live) text-white', warn: 'bg-amber-500 text-black', err: 'bg-destructive text-white' }

  return (
    <>
    {dialog}
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-3">
        <div className="min-w-[200px] flex-1">
          <div className="text-[22px] font-bold">{session.eventName}</div>
          <div className="text-muted-foreground">{session.label} · {session.kioskCode}</div>
        </div>
        <span
          role="status"
          className={cn('rounded-full px-3.5 py-2 font-semibold', online ? 'bg-(--color-live-soft) text-(--color-live)' : 'bg-amber-500 text-black')}
        >
          {online ? (syncing ? 'Syncing…' : 'Online') : 'Offline · scans are saved'}
        </span>
        {pending > 0 && <span className="font-semibold">{pending} waiting to upload</span>}
        <button
          type="button"
          className="min-h-11 cursor-pointer text-base text-muted-foreground underline"
          onClick={async () => { if (await confirm({ title: 'Unpair this tablet?', description: 'Scans not yet uploaded will be lost.', confirmLabel: 'Unpair', destructive: true })) onUnpair() }}
        >
          Unpair
        </button>
      </header>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] items-start gap-6 p-6 max-md:grid-cols-1">
        <section className="grid gap-4">
          {toast && (
            <div role="alert" className={cn('flex items-center gap-4 rounded-xl px-5 py-4 text-[22px] font-semibold', tone[toast.kind])}>
              <span className="flex-1">{toast.text}</span>
              {toast.scanId && toast.kind === 'ok' && (
                <Button className="h-[52px] rounded-xl bg-white px-6 text-lg text-black hover:bg-white/90" onClick={() => undo(toast)}>Undo</Button>
              )}
              <button type="button" aria-label="Dismiss" className="min-h-11 min-w-11 cursor-pointer text-[28px]" onClick={() => setToast(null)}>×</button>
            </div>
          )}

          <div className="flex gap-3">
            <Input
              id="kioskSearch"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) submit(query) }}
              placeholder="Name, email or confirmation code"
              autoComplete="off"
              className="h-16 flex-1 rounded-xl border-2 px-5 text-[22px] md:text-[22px]"
            />
            {canScan && (
              <Button variant="outline" className={bigButton} onClick={scanning ? stopScan : startScan}>{scanning ? 'Stop camera' : 'Scan QR'}</Button>
            )}
          </div>

          <video ref={videoRef} muted playsInline className={cn('max-h-80 w-full rounded-xl bg-black object-cover', scanning ? 'block' : 'hidden')} />

          <div className="grid gap-2.5">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => checkIn(g, 'manual')}
                className="flex min-h-[76px] cursor-pointer items-center gap-4 rounded-xl border-2 border-border bg-card px-5 py-3 text-left text-foreground"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[22px] font-bold">{g.full_name}</span>
                  <span className="block truncate text-base text-muted-foreground">
                    {[g.company, g.email, g.registration_id].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={cn('text-lg font-bold', g.checked_in_at ? 'text-amber-600' : 'text-(--color-live)')}>
                  {g.checked_in_at ? `In ${time(g.checked_in_at)}` : 'Check in'}
                </span>
              </button>
            ))}
            {query.trim() && results.length === 0 && <div className="text-xl text-muted-foreground">No guest matches. Check the spelling or try the email.</div>}
            {!query.trim() && guests.length === 0 && <div className="text-xl text-muted-foreground">{online ? 'Loading the guest list…' : 'No guest list on this tablet yet. Connect to Wi-Fi once to download it.'}</div>}
          </div>
        </section>

        <aside className="grid max-h-[calc(100vh-140px)] grid-rows-[auto_1fr] gap-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-xl font-semibold">Recent pickups <span className="font-normal text-muted-foreground">({guests.filter((g) => g.checked_in_at).length}/{guests.length})</span></h2>
          <ul className="grid content-start gap-1.5 overflow-y-auto">
            {recent.length === 0 && <li className="text-muted-foreground">No one has checked in yet.</li>}
            {recent.map((g) => (
              <li key={g.id} className="flex justify-between gap-2 rounded-lg bg-secondary px-3 py-2.5">
                <span className="min-w-0">
                  <b className="block">{g.full_name}</b>
                  <small className="text-muted-foreground">{g.checked_in_by ?? 'desk'}</small>
                </span>
                <span className="tabular-nums">{time(g.checked_in_at)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
    </>
  )
}
