'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { formatTime } from '@/lib/time'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RecentRow {
  id: string
  registration_id: string
  full_name: string
  badge_collected_at: string | null
  badge_collected_by: string | null
}

interface Found {
  id: string
  registration_id: string
  full_name: string
  designation: string | null
  company: string | null
  badge_collected_at: string | null
  badge_collected_by: string | null
  checkins: { checked_in_at: string }[]
}

// Accepts a registration ID, a badge link, or a token. Returns the lookup key.
function parseCode(input: string): { kind: 'token' | 'reg'; value: string } | null {
  const text = input.trim()
  if (!text) return null
  const badgeMatch = text.match(/\/badge\/([A-Za-z0-9]+)/)
  if (badgeMatch) return { kind: 'token', value: badgeMatch[1]! }
  if (/^[A-Za-z0-9]{32}$/.test(text)) return { kind: 'token', value: text }
  return { kind: 'reg', value: text.toUpperCase() }
}

// Pickup tab of the Desk: find a guest's badge, check it is ready, and mark it collected once.
export default function PickupTab() {
  const params = useParams()
  const eventUuid = params.id as string
  const [code, setCode] = useState('')
  const [found, setFound] = useState<Found | null | 'none'>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<RecentRow[]>([])
  const [staffEmail, setStaffEmail] = useState('')
  const [scanning, setScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window

  // Latest badges handed over, newest first, so staff can see what has already gone out
  const loadRecent = async () => {
    const { data } = await supabase
      .from('registrations')
      .select('id, registration_id, full_name, badge_collected_at, badge_collected_by')
      .eq('event_id', eventUuid)
      .not('badge_collected_at', 'is', null)
      .order('badge_collected_at', { ascending: false })
      .limit(8)
    setRecent((data ?? []) as RecentRow[])
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setStaffEmail(data.user?.email ?? ''))
    loadRecent()
    inputRef.current?.focus()

    const channel = supabase
      .channel(`pickup-${eventUuid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` }, loadRecent)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` }, loadRecent)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [eventUuid])

  const lookup = async (raw: string) => {
    const parsed = parseCode(raw)
    if (!parsed) return
    setMessage('')
    setBusy(true)
    const base = supabase
      .from('registrations')
      .select('id, registration_id, full_name, designation, company, badge_collected_at, badge_collected_by, checkins(checked_in_at)')
      .eq('event_id', eventUuid)
    const { data, error } = await (parsed.kind === 'token'
      ? base.eq('badge_token', parsed.value)
      : base.eq('registration_id', parsed.value)
    ).maybeSingle()
    setBusy(false)
    if (error) {
      setMessage("Couldn't look that up. Try again.")
      return
    }
    setFound(data ? (data as unknown as Found) : 'none')
    setCode('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const collect = async () => {
    if (!found || found === 'none') return
    setBusy(true)
    // Only succeeds if nobody has collected it yet, so a double tap or a second desk cannot hand out two badges
    const { data, error } = await supabase
      .from('registrations')
      .update({ badge_collected_at: new Date().toISOString(), badge_collected_by: staffEmail || 'staff' })
      .eq('id', found.id)
      .is('badge_collected_at', null)
      .select('id, badge_collected_at, badge_collected_by')
      .maybeSingle()
    setBusy(false)
    if (error) {
      setMessage("Couldn't mark the badge as collected. Try again.")
      return
    }
    if (!data) {
      setMessage('This badge was already collected. Check the details below.')
      await refresh()
      return
    }
    setFound({ ...found, badge_collected_at: data.badge_collected_at, badge_collected_by: data.badge_collected_by })
    loadRecent()
    setMessage(`Collected. Hand over the printed badge to ${found.full_name}.`)
  }

  const refresh = async () => {
    if (!found || found === 'none') return
    const { data } = await supabase
      .from('registrations')
      .select('id, registration_id, full_name, designation, company, badge_collected_at, badge_collected_by, checkins(checked_in_at)')
      .eq('id', found.id)
      .single()
    if (data) setFound(data as unknown as Found)
  }

  // Camera scan, where the browser supports BarcodeDetector (Chrome and Edge on Android and desktop)
  const startScan = async () => {
    if (!canScan) return
    setScanning(true)
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).catch(() => null)
    if (!stream || !videoRef.current) {
      setScanning(false)
      setMessage("Couldn't open the camera. Type the code instead.")
      return
    }
    videoRef.current.srcObject = stream
    await videoRef.current.play()
    // BarcodeDetector is not in the standard TypeScript DOM typings yet
    const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    const detector = new Detector({ formats: ['qr_code'] })
    const timer = setInterval(async () => {
      if (!videoRef.current) return
      const hits = await detector.detect(videoRef.current).catch(() => [])
      if (hits.length > 0) {
        clearInterval(timer)
        stream.getTracks().forEach((t) => t.stop())
        setScanning(false)
        lookup(hits[0]!.rawValue)
      }
    }, 400)
  }

  const status = (() => {
    if (found === null) return null
    if (found === 'none') return { tone: 'error', text: 'No badge matches that code for this event.' }
    if (found.badge_collected_at) {
      return { tone: 'warning', text: `Already collected at ${formatTime(found.badge_collected_at)}${found.badge_collected_by ? ` by ${found.badge_collected_by}` : ''}.` }
    }
    if (found.checkins.length === 0) return { tone: 'warning', text: 'Not checked in yet. Send the guest to the check-in desk first.' }
    return { tone: 'success', text: 'Checked in and ready to collect.' }
  })()

  return (
    <div className="max-w-[640px]">
      <form onSubmit={(e) => { e.preventDefault(); lookup(code) }} className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="pickup-code" className="sr-only">
          Registration ID or badge link
        </label>
        <Input
          id="pickup-code"
          ref={inputRef}
          className="h-11 min-w-[260px] flex-1 text-lg"
          placeholder="Scan or type the registration ID"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <Button type="submit" size="lg" className="h-11 px-4" disabled={busy || !code.trim()}>
          Find badge
        </Button>
        {canScan && (
          <Button type="button" variant="outline" size="lg" className="h-11 px-4" onClick={startScan} disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan with camera'}
          </Button>
        )}
      </form>

      {scanning && (
        <video ref={videoRef} muted playsInline aria-label="Camera preview" className="mb-4 w-full rounded-xl bg-black" />
      )}

      {message && <p role="status" className="mb-3 text-sm text-muted-foreground">{message}</p>}

      {status && (
        <Alert variant={status.tone === 'success' ? 'success' : status.tone === 'warning' ? 'warning' : 'error'} className="mb-4">
          {status.text}
        </Alert>
      )}

      {found && found !== 'none' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-lg font-semibold">{found.full_name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[found.designation, found.company].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-2 text-[13px]">
            Registration ID <code className="font-mono font-semibold">{found.registration_id}</code>
          </p>
          {!found.badge_collected_at && found.checkins.length > 0 && (
            <Button type="button" className="mt-4 h-[52px] w-full text-base" onClick={collect} disabled={busy}>
              {busy ? 'Saving...' : 'Mark as collected'}
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="recent-heading" className="mt-7">
        <h2 id="recent-heading" className="mb-2 text-[15px] font-semibold">Recently collected</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No badges collected yet. Each badge you mark as collected appears here.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 border-t border-border px-4 py-2.5 text-sm first:border-t-0">
                <span className="font-medium">{r.full_name}</span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {r.badge_collected_at ? formatTime(r.badge_collected_at) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
