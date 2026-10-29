'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateTime } from '@/lib/time'
import { completeName } from '@/lib/guests'
import {
  BadgeDesign, BadgeImages, PAPER_SIZES, Paper, badgeDataFor, defaultDesign, parseDesign, sheetGrid,
} from '@/lib/badgeDesign'
import type { PrintLayout } from '@/lib/badgePdf'
import BadgePreview from '@/components/BadgePreview'

interface EventInfo {
  id: string
  event_id: string
  name: string
  location: string
  country: string | null
  city: string | null
  event_date: string
  logo_path: string | null
  organizations: { logo_path: string | null } | null
}

interface Attendee {
  id: string
  registration_id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  designation: string | null
  company: string | null
  country: string | null
  city: string | null
  industry: string | null
  registration_status: string | null
  source: string
}

interface BadgePrint {
  registration_id: string
  printed_at: string
  printed_by: string
}

interface SavedDesign {
  id: string
  name: string
  is_default: boolean
  design: unknown
}

interface Preview {
  url: string
  attendees: Attendee[]
  pages: number
}

const CARD_WIDTH_PX = 300

export default function BadgesPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [prints, setPrints] = useState<BadgePrint[]>([])
  const [designs, setDesigns] = useState<SavedDesign[]>([])
  const [designId, setDesignId] = useState('')
  const [staffName, setStaffName] = useState('Staff')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [layout, setLayout] = useState<PrintLayout>({ mode: 'single', paper: 'A4', guides: true })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [eventRes, regRes, printRes, designRes, profileRes] = await Promise.all([
      supabase.from('events').select('id, event_id, name, location, country, city, event_date, logo_path, organizations(logo_path)').eq('id', eventUuid).single(),
      supabase
        .from('registrations')
        .select('id, registration_id, full_name, first_name, last_name, designation, company, country, city, industry, registration_status, source')
        .eq('event_id', eventUuid)
        .order('full_name'),
      supabase.from('badge_prints').select('registration_id, printed_at, printed_by').eq('event_id', eventUuid).order('printed_at', { ascending: false }),
      supabase.from('badge_designs').select('id, name, is_default, design').eq('event_id', eventUuid).order('created_at'),
      user ? supabase.from('profiles').select('full_name').eq('id', user.id).single() : Promise.resolve({ data: null }),
    ])
    if (eventRes.error || !eventRes.data) {
      setError('Event not found')
      return
    }
    setEvent(eventRes.data as unknown as EventInfo)
    setAttendees((regRes.data ?? []) as Attendee[])
    setPrints((printRes.data ?? []) as BadgePrint[])
    const list = (designRes.data ?? []) as SavedDesign[]
    setDesigns(list)
    setDesignId((current) => current || (list.find((d) => d.is_default) ?? list[0])?.id || '')
    if (profileRes.data?.full_name) setStaffName(profileRes.data.full_name)
  }, [eventUuid])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Arriving from a guest's drawer (?guest=<id>): start with that guest selected
  useEffect(() => {
    const guestId = new URLSearchParams(window.location.search).get('guest')
    if (guestId) setSelected(new Set([guestId]))
  }, [])

  // Saved design chosen for printing, or the built-in default template
  const design: BadgeDesign = useMemo(() => {
    const saved = designs.find((d) => d.id === designId)
    return saved ? parseDesign(saved.design) : defaultDesign()
  }, [designs, designId])

  const images: BadgeImages = useMemo(
    () => ({ eventLogoPath: event?.logo_path ?? null, orgLogoPath: event?.organizations?.logo_path ?? null }),
    [event]
  )

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
    return attendees.filter((a) => [a.registration_id, a.full_name, a.company, a.designation].some((v) => v?.toLowerCase().includes(q)))
  }, [attendees, search])

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  // Builds the PDF and shows it in the print preview
  const openPreview = async (list: Attendee[]) => {
    if (!event || list.length === 0) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { buildDesignBadgesPdf } = await import('@/lib/badgePdf')
      const bytes = await buildDesignBadgesPdf(
        `${event.name} badges`,
        design,
        list.map((a) => badgeDataFor(a, event)),
        images,
        layout
      )
      if (preview) URL.revokeObjectURL(preview.url)
      const pages = layout.mode === 'single' ? list.length : Math.ceil(list.length / sheetGrid(layout.paper, design.widthMm, design.heightMm).perPage)
      setPreview({ url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })), attendees: list, pages })
    } catch (err) {
      setError((err as Error).message || 'Could not create the badge PDF.')
    } finally {
      setBusy(false)
    }
  }

  const recordPrints = async (list: Attendee[]) => {
    if (!event) return
    const { error: printError } = await supabase.from('badge_prints').insert(
      list.map((a) => ({ registration_id: a.id, event_id: event.id, printed_by: staffName }))
    )
    if (printError) setError('Badges printed, but the print history was not saved: ' + printError.message)
    else setNotice(`Recorded ${list.length} badge print(s).`)
    loadData()
  }

  if (!event) return error ? <p className="alert-error">{error}</p> : <p>Loading badges...</p>

  const grid = sheetGrid(layout.paper, design.widthMm, design.heightMm)
  const cardScale = CARD_WIDTH_PX / design.widthMm
  const selectedList = attendees.filter((a) => selected.has(a.id))

  return (
    <div style={{ maxWidth: '1400px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Badge Printing</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            {event.name} • {attendees.length} attendee{attendees.length === 1 ? '' : 's'} • {lastPrint.size} printed
          </p>
        </div>
        <Link href={`/events/${event.id}/badge-design`} className="btn-secondary">Edit badge design</Link>
      </div>

      {/* Design and page layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '6px', marginBottom: '16px' }}>
        <label style={{ fontSize: '14px' }}>
          Design
          <select className="input-field" value={designId} onChange={(e) => setDesignId(e.target.value)} style={{ marginTop: '4px' }}>
            {designs.length === 0 && <option value="">Default template</option>}
            {designs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_default ? ' (default)' : ''}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '14px' }}>
          Page layout
          <select className="input-field" value={layout.mode} onChange={(e) => setLayout({ ...layout, mode: e.target.value as PrintLayout['mode'] })} style={{ marginTop: '4px' }}>
            <option value="single">One badge per page (badge printers)</option>
            <option value="sheet">Several per sheet (office printers)</option>
          </select>
        </label>
        {layout.mode === 'sheet' && (
          <>
            <label style={{ fontSize: '14px' }}>
              Paper
              <select className="input-field" value={layout.paper} onChange={(e) => setLayout({ ...layout, paper: e.target.value as Paper })} style={{ marginTop: '4px' }}>
                {(Object.keys(PAPER_SIZES) as Paper[]).map((p) => <option key={p} value={p}>{PAPER_SIZES[p].label}</option>)}
              </select>
            </label>
            <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '6px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={layout.guides} onChange={(e) => setLayout({ ...layout, guides: e.target.checked })} /> Cut guides
              </label>
              <span style={{ color: grid.perPage ? 'var(--color-text-secondary)' : 'var(--color-error-red)' }}>
                {grid.perPage ? `${grid.perPage} badges per sheet (${grid.cols} × ${grid.rows})` : 'Badge is too large for this paper'}
              </span>
            </div>
          </>
        )}
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Badge size {Math.round(design.widthMm * 10) / 10} × {Math.round(design.heightMm * 10) / 10} mm. In the print dialog choose &quot;Actual size&quot; (100%) so badges aren&apos;t rescaled.
      </p>

      {notice && <div className="alert-success" style={{ marginBottom: '16px' }}>{notice}</div>}
      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field"
          placeholder="Search name, company, designation or reg ID"
          aria-label="Search attendees"
          style={{ flex: '1 1 280px' }}
        />
        <button className="btn-primary" onClick={() => openPreview(selectedList)} disabled={busy || selectedList.length === 0}>
          Print selected ({selectedList.length})
        </button>
        <button className="btn-secondary" onClick={() => openPreview(filtered)} disabled={busy || filtered.length === 0}>
          Print all shown ({filtered.length})
        </button>
        {selected.size > 0 && <button className="btn-secondary" onClick={() => setSelected(new Set())}>Clear selection</button>}
        {busy && <span style={{ fontSize: '14px' }}>Preparing PDF...</span>}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)' }}>
          {attendees.length === 0 ? 'No attendees yet. Add them in Attendees.' : 'No attendees match your search.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_WIDTH_PX + 26}px, 1fr))`, gap: '16px' }}>
          {filtered.map((a) => (
            <BadgeCard
              key={a.id}
              attendee={a}
              preview={
                <BadgePreview design={design} data={badgeDataFor(a, event)} images={images} scale={cardScale} />
              }
              last={lastPrint.get(a.id)}
              selected={selected.has(a.id)}
              onToggle={() => toggle(a.id)}
              editing={editing === a.id}
              busy={busy}
              onEdit={() => setEditing(a.id)}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                loadData()
              }}
              onPrint={() => openPreview([a])}
            />
          ))}
        </div>
      )}

      {preview && (
        <PrintPreview
          preview={preview}
          onClose={() => {
            URL.revokeObjectURL(preview.url)
            setPreview(null)
          }}
          onPrinted={() => recordPrints(preview.attendees)}
          fileName={`${event.event_id}-badges.pdf`}
        />
      )}
    </div>
  )
}

function PrintPreview({ preview, onClose, onPrinted, fileName }: { preview: Preview; onClose: () => void; onPrinted: () => void; fileName: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [recorded, setRecorded] = useState(false)

  const markPrinted = () => {
    if (recorded) return
    setRecorded(true)
    onPrinted()
  }

  const print = () => {
    try {
      frameRef.current?.contentWindow?.focus()
      frameRef.current?.contentWindow?.print()
    } catch {
      window.open(preview.url, '_blank')
    }
    markPrinted()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Print preview" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', flexDirection: 'column', padding: '16px' }}>
      <div style={{ backgroundColor: 'var(--color-white)', borderRadius: '8px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Print preview</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {preview.attendees.length} badge{preview.attendees.length === 1 ? '' : 's'} on {preview.pages} page{preview.pages === 1 ? '' : 's'}
              {recorded ? ' • print recorded' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={print}>Print</button>
            <a className="btn-secondary" href={preview.url} download={fileName} onClick={markPrinted}>Download PDF</a>
            <a className="btn-secondary" href={preview.url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
        <iframe ref={frameRef} src={preview.url} title="Badge PDF preview" style={{ flex: 1, border: 'none', width: '100%', backgroundColor: '#525659' }} />
      </div>
    </div>
  )
}

function BadgeCard({
  attendee, preview, last, selected, onToggle, editing, busy, onEdit, onCancel, onSaved, onPrint,
}: {
  attendee: Attendee
  preview: React.ReactNode
  last?: BadgePrint & { count: number }
  selected: boolean
  onToggle: () => void
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

  // Name and designation edits are saved to the attendee record
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
    <div style={{ border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: '6px', padding: '12px' }}>
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px', marginBottom: '8px' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span style={{ fontWeight: 600 }}>{attendee.full_name}</span>
        <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{attendee.registration_id}</span>
      </label>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', padding: '8px', backgroundColor: 'var(--color-neutral-light)', borderRadius: '6px' }}>
        {preview}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" aria-label="Name on badge" placeholder="Name" maxLength={120} />
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} className="input-field" aria-label="Designation on badge" placeholder="Designation" maxLength={120} />
          {error && <div className="alert-error" style={{ fontSize: '14px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary" onClick={onCancel} disabled={saving} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px', minHeight: '18px' }}>
            {last ? `Last printed: ${formatDateTime(last.printed_at)} by ${last.printed_by}${last.count > 1 ? ` (${last.count} prints)` : ''}` : 'Not printed yet'}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={onPrint} disabled={busy} style={{ flex: 1 }}>{last ? 'Print again' : 'Print'}</button>
            <button className="btn-secondary" onClick={onEdit} disabled={busy} style={{ flex: 1 }}>Edit</button>
          </div>
        </>
      )}
    </div>
  )
}
