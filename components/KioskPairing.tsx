'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useConfirm } from '@/components/ConfirmDialog'

interface KioskRow {
  id: string
  kiosk_code: string
  label: string
  last_seen_at: string | null
  revoked_at: string | null
}

// Kiosk devices for one event: create a one-time pairing code, see paired tablets, revoke a lost one.
export default function KioskPairing({ eventUuid }: { eventUuid: string }) {
  const [label, setLabel] = useState('')
  const [pairing, setPairing] = useState<{ code: string; kioskCode: string; expiresAt: string } | null>(null)
  const [kiosks, setKiosks] = useState<KioskRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { confirm, dialog } = useConfirm()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('kiosks')
      .select('id, kiosk_code, label, last_seen_at, revoked_at')
      .eq('event_id', eventUuid)
      .order('created_at')
    setKiosks((data ?? []) as KioskRow[])
  }, [eventUuid])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  const create = async () => {
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.rpc('create_kiosk_pairing', { p_event_id: eventUuid, p_label: label || 'Gate' })
    setBusy(false)
    if (err) {
      setError(err.message.includes('kiosk_name_taken') ? 'A kiosk with that name already exists. Pick another name.' : "Couldn't create a code. Try again.")
      return
    }
    const row = data?.[0]
    if (row) setPairing({ code: row.code, kioskCode: row.kiosk_code, expiresAt: row.expires_at })
    setLabel('')
    load()
  }

  const revoke = async (k: KioskRow) => {
    const ok = await confirm({
      title: `Revoke ${k.kiosk_code}?`,
      description: 'The tablet loses access straight away. Scans it has not uploaded yet stay on the tablet.',
      confirmLabel: 'Revoke',
      destructive: true,
    })
    if (!ok) return
    await supabase.from('kiosks').update({ revoked_at: new Date().toISOString() }).eq('id', k.id)
    load()
  }

  const online = (k: KioskRow) => !!k.last_seen_at && Date.now() - new Date(k.last_seen_at).getTime() < 90000

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
      {dialog}
      <div>
        <h2 className="text-base font-semibold">Kiosk devices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name a gate, get a one-time 6-digit code, and type it on the tablet at <b>/kiosk</b>. The tablet keeps the guest list offline and uploads scans when Wi-Fi is back.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input id="kioskLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. Gate 1" maxLength={40} className="max-w-xs" aria-label="Kiosk name" />
        <Button onClick={create} disabled={busy}>Pair a kiosk</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {pairing && (
        <div className="rounded-lg bg-primary/10 p-4">
          <div className="text-4xl font-bold tabular-nums tracking-[0.2em]">{pairing.code}</div>
          <p className="mt-1 text-sm">
            For {pairing.kioskCode}. Valid until {new Date(pairing.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, one use.
          </p>
        </div>
      )}

      <ul className="grid gap-2">
        {kiosks.length === 0 && <li className="text-sm text-muted-foreground">No kiosks paired yet.</li>}
        {kiosks.map((k) => (
          <li key={k.id} className={'flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 ' + (k.revoked_at ? 'opacity-50' : '')}>
            <span className="min-w-0 flex-1">
              <b>{k.kiosk_code}</b> <span className="text-sm text-muted-foreground">{k.label}</span>
            </span>
            <Badge variant={k.revoked_at ? 'outline' : online(k) ? 'default' : 'secondary'}>
              {k.revoked_at ? 'Revoked' : online(k) ? 'Online' : 'Not seen recently'}
            </Badge>
            {!k.revoked_at && <Button variant="outline" size="sm" onClick={() => revoke(k)}>Revoke</Button>}
          </li>
        ))}
      </ul>
    </section>
  )
}
