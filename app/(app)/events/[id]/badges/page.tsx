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
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

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
    <div className="max-w-[1400px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-[28px] font-bold">Badge Printing</h1>
          <p className="text-base text-muted-foreground">
            {event.name} • {attendees.length} attendee{attendees.length === 1 ? '' : 's'} • {lastPrint.size} printed
          </p>
        </div>
        <Button variant="outline" render={<Link href={`/events/${event.id}/badge-design`} />} nativeButton={false}>Edit badge design</Button>
      </div>

      {/* Design and page layout */}
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 rounded-md border border-border p-3">
        <label className="grid gap-1 text-sm">
          Design
          <NativeSelect className="h-10" value={designId} onChange={(e) => setDesignId(e.target.value)}>
            {designs.length === 0 && <option value="">Default template</option>}
            {designs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_default ? ' (default)' : ''}</option>)}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          Page layout
          <NativeSelect className="h-10" value={layout.mode} onChange={(e) => setLayout({ ...layout, mode: e.target.value as PrintLayout['mode'] })}>
            <option value="single">One badge per page (badge printers)</option>
            <option value="sheet">Several per sheet (office printers)</option>
          </NativeSelect>
        </label>
        {layout.mode === 'sheet' && (
          <>
            <label className="grid gap-1 text-sm">
              Paper
              <NativeSelect className="h-10" value={layout.paper} onChange={(e) => setLayout({ ...layout, paper: e.target.value as Paper })}>
                {(Object.keys(PAPER_SIZES) as Paper[]).map((p) => <option key={p} value={p}>{PAPER_SIZES[p].label}</option>)}
              </NativeSelect>
            </label>
            <div className="flex flex-col justify-end gap-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={layout.guides} onChange={(e) => setLayout({ ...layout, guides: e.target.checked })} /> Cut guides
              </label>
              <span className={grid.perPage ? 'text-muted-foreground' : 'text-destructive'}>
                {grid.perPage ? `${grid.perPage} badges per sheet (${grid.cols} × ${grid.rows})` : 'Badge is too large for this paper'}
              </span>
            </div>
          </>
        )}
      </div>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Badge size {Math.round(design.widthMm * 10) / 10} × {Math.round(design.heightMm * 10) / 10} mm. In the print dialog choose &quot;Actual size&quot; (100%) so badges aren&apos;t rescaled.
      </p>

      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-[280px] flex-1"
          placeholder="Search name, company, designation or reg ID"
          aria-label="Search attendees"
        />
        <Button onClick={() => openPreview(selectedList)} disabled={busy || selectedList.length === 0}>
          Print selected ({selectedList.length})
        </Button>
        <Button variant="outline" onClick={() => openPreview(filtered)} disabled={busy || filtered.length === 0}>
          Print all shown ({filtered.length})
        </Button>
        {selected.size > 0 && <Button variant="outline" onClick={() => setSelected(new Set())}>Clear selection</Button>}
        {busy && <span className="text-sm">Preparing PDF...</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
          {attendees.length === 0 ? 'No attendees yet. Add them in Attendees.' : 'No attendees match your search.'}
        </div>
      ) : (
        // 326px = CARD_WIDTH_PX (300) plus the card's padding and border
        <div className="grid grid-cols-[repeat(auto-fill,minmax(326px,1fr))] gap-4">
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
    <div role="dialog" aria-modal="true" aria-label="Print preview" className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4">
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col overflow-hidden rounded-lg bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">Print preview</h2>
            <p className="text-[13px] text-muted-foreground">
              {preview.attendees.length} badge{preview.attendees.length === 1 ? '' : 's'} on {preview.pages} page{preview.pages === 1 ? '' : 's'}
              {recorded ? ' • print recorded' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={print}>Print</Button>
            <Button variant="outline" render={<a href={preview.url} download={fileName} onClick={markPrinted} />} nativeButton={false}>Download PDF</Button>
            <Button variant="outline" render={<a href={preview.url} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>Open in new tab</Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
        <iframe ref={frameRef} src={preview.url} title="Badge PDF preview" className="w-full flex-1 border-0 bg-[#525659]" />
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
    <div className={cn('rounded-md border p-3', selected ? 'border-primary' : 'border-border')}>
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className="font-semibold">{attendee.full_name}</span>
        <span className="font-mono text-muted-foreground">{attendee.registration_id}</span>
      </label>
      <div className="mb-3 flex justify-center rounded-md bg-muted p-2">
        {preview}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" aria-label="Name on badge" placeholder="Name" maxLength={120} />
          <Input value={designation} onChange={(e) => setDesignation(e.target.value)} className="h-10" aria-label="Designation on badge" placeholder="Designation" maxLength={120} />
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-2 min-h-[18px] text-[13px] text-muted-foreground">
            {last ? `Last printed: ${formatDateTime(last.printed_at)} by ${last.printed_by}${last.count > 1 ? ` (${last.count} prints)` : ''}` : 'Not printed yet'}
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onPrint} disabled={busy}>{last ? 'Print again' : 'Print'}</Button>
            <Button variant="outline" className="flex-1" onClick={onEdit} disabled={busy}>Edit</Button>
          </div>
        </>
      )}
    </div>
  )
}
