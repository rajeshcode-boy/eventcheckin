'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/time'
import { completeName } from '@/lib/guests'
import type { BadgeData } from '@/lib/pdf'

interface EventInfo {
  id: string
  event_id: string
  name: string
}

interface Attendee {
  id: string
  registration_id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  designation: string | null
  company: string | null
  source: string
}

interface BadgePrint {
  registration_id: string
  printed_at: string
  printed_by: string
}

export default function BadgesPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [prints, setPrints] = useState<BadgePrint[]>([])
  const [staffName, setStaffName] = useState('Staff')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [eventRes, regRes, printRes, profileRes] = await Promise.all([
      supabase.from('events').select('id, event_id, name').eq('id', eventUuid).single(),
      supabase
        .from('registrations')
        .select('id, registration_id, full_name, first_name, last_name, designation, company, source')
        .eq('event_id', eventUuid)
        .order('full_name'),
      supabase
        .from('badge_prints')
        .select('registration_id, printed_at, printed_by')
        .eq('event_id', eventUuid)
        .order('printed_at', { ascending: false }),
      user ? supabase.from('profiles').select('full_name').eq('id', user.id).single() : Promise.resolve({ data: null }),
    ])
    if (eventRes.error || !eventRes.data) {
      setError('Event not found')
      return
    }
    setEvent(eventRes.data)
    setAttendees((regRes.data ?? []) as Attendee[])
    setPrints((printRes.data ?? []) as BadgePrint[])
    if (profileRes.data?.full_name) setStaffName(profileRes.data.full_name)
  }, [eventUuid])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Newest print per attendee, keyed by registrations.id (prints are sorted newest first)
  const lastPrint = useMemo(() => {
    const map = new Map<string, BadgePrint & { count: number }>()
    for (const p of prints) {
      const existing = map.get(p.registration_id)
      if (existing) existing.count++
      else map.set(p.registration_id, { ...p, count: 1 })
    }
    return map
  }, [prints])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return attendees
    return attendees.filter((a) =>
      [a.registration_id, a.full_name, a.company, a.designation].some((v) => v?.toLowerCase().includes(q))
    )
  }, [attendees, search])

  const printBadges = async (list: Attendee[]) => {
    if (!event || list.length === 0) return
    setError('')
    setNotice('')
    // Open the tab now, while the click still counts as a user action (avoids popup blockers)
    const tab = window.open('', '_blank')
    setBusy(true)
    try {
      const { buildBadgesPdf } = await import('@/lib/pdf')
      const badges: BadgeData[] = list.map((a) => ({
        name: a.full_name,
        designation: a.designation,
        company: a.company,
        registrationId: a.registration_id,
      }))
      const bytes = await buildBadgesPdf(event.name, badges)
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      setPdfUrl(url)
      if (tab) tab.location.href = url

      const { error: printError } = await supabase.from('badge_prints').insert(
        list.map((a) => ({ registration_id: a.id, event_id: event.id, printed_by: staffName }))
      )
      if (printError) setError('Badge opened, but the print was not recorded: ' + printError.message)
      else setNotice(`${list.length} badge(s) ready. Print from the PDF tab, or open it with the link if no tab appeared.`)
      loadData()
    } catch {
      tab?.close()
      setError('Could not create the badge PDF. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!event) {
    return error ? <p className="alert-error">{error}</p> : <p>Loading badges...</p>
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href={`/events/${event.id}`} style={{ color: 'var(--color-primary-green)', fontSize: '14px' }}>
          ← Back to {event.name}
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Badge Printing</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            {event.name} • {attendees.length} attendee{attendees.length === 1 ? '' : 's'} • {lastPrint.size} printed
          </p>
        </div>
        <button className="btn-primary" onClick={() => printBadges(filtered)} disabled={busy || filtered.length === 0}>
          Print all shown ({filtered.length})
        </button>
      </div>

      {notice && (
        <div className="alert-success" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span>{notice}</span>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: 'underline' }}>
              Open badge PDF
            </a>
          )}
        </div>
      )}
      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field"
        placeholder="Search name, company, designation or reg ID"
        style={{ marginBottom: '16px' }}
      />

      {filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)' }}>
          {attendees.length === 0 ? 'No attendees yet. Add them in Attendee Registration.' : 'No attendees match your search.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map((a) => (
            <BadgeCard
              key={a.id}
              attendee={a}
              eventName={event.name}
              last={lastPrint.get(a.id)}
              editing={editing === a.id}
              busy={busy}
              onEdit={() => setEditing(a.id)}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                loadData()
              }}
              onPrint={() => printBadges([a])}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BadgeCard({
  attendee,
  eventName,
  last,
  editing,
  busy,
  onEdit,
  onCancel,
  onSaved,
  onPrint,
}: {
  attendee: Attendee
  eventName: string
  last?: BadgePrint & { count: number }
  editing: boolean
  busy: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
  onPrint: () => void
}) {
  const [name, setName] = useState(attendee.full_name)
  const [designation, setDesignation] = useState(attendee.designation ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(attendee.full_name)
      setDesignation(attendee.designation ?? '')
      setError('')
    }
  }, [editing, attendee])

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    const names = completeName({ full_name: name.trim().replace(/\s+/g, ' ') })
    const { error: saveError } = await supabase
      .from('registrations')
      .update({
        full_name: names.full_name,
        first_name: names.first_name ?? null,
        last_name: names.last_name ?? null,
        designation: designation.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendee.id)
    setSaving(false)
    if (saveError) setError('Could not save: ' + saveError.message)
    else onSaved()
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px' }}>
      {/* Badge preview (matches the PDF layout) */}
      <div style={{ backgroundColor: '#ffffff', color: '#111827', borderRadius: '6px', overflow: 'hidden', border: '1px solid #d1d5db', aspectRatio: '4 / 3', display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
        <div style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', padding: '8px', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eventName}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '8px', textAlign: 'center' }}>
          <p style={{ fontSize: '22px', fontWeight: 'bold', lineHeight: 1.2 }}>{editing ? name || '—' : attendee.full_name}</p>
          {(editing ? designation : attendee.designation) && (
            <p style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px' }}>{editing ? designation : attendee.designation}</p>
          )}
          {attendee.company && <p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px' }}>{attendee.company}</p>}
        </div>
        <div style={{ borderTop: '1px solid #e5e7eb', textAlign: 'center', padding: '6px', fontFamily: 'monospace', fontSize: '13px', color: '#4b5563' }}>
          {attendee.registration_id}
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" aria-label="Name on badge" placeholder="Name" />
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="input-field" aria-label="Designation on badge" placeholder="Designation" />
          {error && <div className="alert-error" style={{ fontSize: '14px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn-secondary" onClick={onCancel} disabled={saving} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px', minHeight: '18px' }}>
            {last
              ? `Last printed: ${formatDateTime(last.printed_at)} by ${last.printed_by}${last.count > 1 ? ` (${last.count} prints)` : ''}`
              : 'Not printed yet'}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={onPrint} disabled={busy} style={{ flex: 1 }}>
              {last ? 'Print again' : 'Print'}
            </button>
            <button className="btn-secondary" onClick={onEdit} disabled={busy} style={{ flex: 1 }}>
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
