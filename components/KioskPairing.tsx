'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface KioskRow {
  id: string
  kiosk_code: string
  label: string
  last_seen_at: string | null
  revoked_at: string | null
}

// Organiser panel: create a one-time pairing code for a tablet, see paired kiosks, revoke a lost one.
export default function KioskPairing({ eventUuid }: { eventUuid: string }) {
  const [label, setLabel] = useState('')
  const [pairing, setPairing] = useState<{ code: string; kioskCode: string; expiresAt: string } | null>(null)
  const [kiosks, setKiosks] = useState<KioskRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const revoke = async (id: string) => {
    await supabase.from('kiosks').update({ revoked_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const online = (k: KioskRow) => k.last_seen_at && Date.now() - new Date(k.last_seen_at).getTime() < 90000

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--color-surface)', display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Check-in kiosks</h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
        Open <b>/kiosk</b> on a tablet and type the code. The tablet keeps the guest list offline and uploads scans when Wi-Fi is back.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input id="kioskLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. Gate 1" maxLength={40} style={{ flex: 1, minWidth: 160 }} />
        <button onClick={create} disabled={busy} className="btn-primary">Pair a kiosk</button>
      </div>
      {error && <div role="alert" style={{ color: 'var(--color-error-red)' }}>{error}</div>}
      {pairing && (
        <div style={{ padding: 12, background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '0.2em', fontVariantNumeric: 'tabular-nums' }}>{pairing.code}</div>
          <div style={{ fontSize: 14 }}>For {pairing.kioskCode}. Valid until {new Date(pairing.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, one use.</div>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {kiosks.map((k) => (
          <li key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: k.revoked_at ? 0.5 : 1 }}>
            <span style={{ flex: 1 }}><b>{k.kiosk_code}</b> <small style={{ color: 'var(--color-text-secondary)' }}>{k.label}</small></span>
            <span style={{ fontSize: 13, color: online(k) ? 'var(--color-live)' : 'var(--color-text-secondary)' }}>
              {k.revoked_at ? 'Revoked' : online(k) ? 'Online' : 'Not seen recently'}
            </span>
            {!k.revoked_at && <button onClick={() => revoke(k.id)}>Revoke</button>}
          </li>
        ))}
        {kiosks.length === 0 && <li style={{ color: 'var(--color-text-secondary)' }}>No kiosks paired yet.</li>}
      </ul>
    </section>
  )
}
