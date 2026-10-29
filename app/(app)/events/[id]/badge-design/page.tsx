'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BadgePreview from '@/components/BadgePreview'
import {
  BADGE_FIELDS, BadgeDesign, BadgeElement, BadgeImages, ImageElement, LIMITS, RectElement, SAMPLE_BADGE_DATA, SIZE_PRESETS,
  TextElement, badgeDataFor, defaultDesign, newElementId, parseDesign, resizeDesign, rotateDesign, textElement,
} from '@/lib/badgeDesign'
import { BADGE_BACKGROUND_RULES, ImageRules, LOGO_RULES, validateImageFile } from '@/lib/images'
import { uploadImage } from '@/lib/storage'
import { useEventRole } from '@/components/EventRoleContext'
import { canManageEvent } from '@/lib/permissions'

interface EventInfo {
  id: string
  organization_id: string
  event_id: string
  name: string
  location: string
  country: string | null
  city: string | null
  event_date: string
  logo_path: string | null
  organizations: { logo_path: string | null } | null
}

interface SavedDesign {
  id: string
  name: string
  is_default: boolean
  design: unknown
}

interface PreviewAttendee {
  id: string
  registration_id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  company: string | null
  designation: string | null
  country: string | null
  city: string | null
  industry: string | null
  registration_status: string | null
}

const label: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }
const section: React.CSSProperties = { padding: '12px', border: '1px solid var(--color-border)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }
const small: React.CSSProperties = { minHeight: '36px', padding: '6px 10px', fontSize: '13px' }
const round = (v: number) => Math.round(v * 10) / 10

function elementName(el: BadgeElement): string {
  if (el.type === 'text') return el.source === 'static' ? `Text: ${el.text || '(empty)'}` : BADGE_FIELDS.find((f) => f.value === el.field)?.label ?? 'Text'
  if (el.type === 'image') return el.label || (el.source === 'event_logo' ? 'Event logo' : el.source === 'org_logo' ? 'Organizer logo' : 'Sponsor logo')
  if (el.type === 'qr') return 'QR code (registration ID)'
  return 'Rectangle'
}

export default function BadgeDesignPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const role = useEventRole()
  const isAdmin = canManageEvent(role)
  const [designs, setDesigns] = useState<SavedDesign[]>([])
  const [attendees, setAttendees] = useState<PreviewAttendee[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [design, setDesign] = useState<BadgeDesign>(() => defaultDesign())
  const [name, setName] = useState('Default badge')
  const [dirty, setDirty] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState('')
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [eventRes, designRes, attendeeRes] = await Promise.all([
      supabase.from('events').select('id, organization_id, event_id, name, location, country, city, event_date, logo_path, organizations(logo_path)').eq('id', eventUuid).single(),
      supabase.from('badge_designs').select('id, name, is_default, design').eq('event_id', eventUuid).order('created_at'),
      supabase.from('registrations').select('id, registration_id, full_name, first_name, last_name, company, designation, country, city, industry, registration_status').eq('event_id', eventUuid).order('full_name').limit(500),
    ])
    if (eventRes.error || !eventRes.data) {
      setError('Event not found')
      return
    }
    setEvent(eventRes.data as unknown as EventInfo)
    setAttendees((attendeeRes.data ?? []) as PreviewAttendee[])
    const list = (designRes.data ?? []) as SavedDesign[]
    setDesigns(list)
    return list
  }, [eventUuid])

  useEffect(() => {
    load().then((list) => {
      const initial = list?.find((d) => d.is_default) ?? list?.[0]
      if (initial) openDesign(initial)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const openDesign = (d: SavedDesign) => {
    setCurrentId(d.id)
    setName(d.name)
    setDesign(parseDesign(d.design))
    setDirty(false)
    setSelectedId(null)
  }

  const change = (next: BadgeDesign) => {
    setDesign(next)
    setDirty(true)
    setNotice('')
  }

  const updateElement = (el: BadgeElement) => change({ ...design, elements: design.elements.map((e) => (e.id === el.id ? el : e)) })
  const selected = design.elements.find((e) => e.id === selectedId) ?? null

  const addElement = (el: BadgeElement) => {
    if (design.elements.length >= LIMITS.maxElements) {
      setError(`A badge can have at most ${LIMITS.maxElements} elements.`)
      return
    }
    change({ ...design, elements: [...design.elements, el] })
    setSelectedId(el.id)
  }

  const centred = (w: number, h: number) => ({ x: round((design.widthMm - w) / 2), y: round((design.heightMm - h) / 2), w, h })

  const removeElement = (id: string) => {
    change({ ...design, elements: design.elements.filter((e) => e.id !== id) })
    setSelectedId(null)
  }

  const moveLayer = (id: string, delta: number) => {
    const i = design.elements.findIndex((e) => e.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= design.elements.length) return
    const elements = [...design.elements]
    ;[elements[i], elements[j]] = [elements[j]!, elements[i]!]
    change({ ...design, elements })
  }

  const duplicateElement = (el: BadgeElement) => addElement({ ...el, id: newElementId(), x: el.x + 3, y: el.y + 3 })

  // Arrow keys nudge the selected element (Shift = 5 mm), Delete removes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const step = e.shiftKey ? 5 : 0.5
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (moves[e.key]) {
        e.preventDefault()
        const [dx, dy] = moves[e.key]!
        updateElement({ ...selected, x: round(selected.x + dx), y: round(selected.y + dy) })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeElement(selected.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const save = async (asNew = false) => {
    if (!event) return
    setError('')
    setNotice('')
    if (!name.trim()) {
      setError('Give the design a name.')
      return
    }
    setBusy(true)
    if (currentId && !asNew) {
      const { error: updateError } = await supabase
        .from('badge_designs')
        .update({ name: name.trim(), design, updated_at: new Date().toISOString() })
        .eq('id', currentId)
      setBusy(false)
      if (updateError) {
        setError('Could not save: ' + updateError.message)
        return
      }
    } else {
      const newName = asNew ? `${name.trim()} (copy)`.slice(0, 80) : name.trim()
      const { data, error: insertError } = await supabase
        .from('badge_designs')
        .insert([{ event_id: event.id, name: newName, design, is_default: designs.length === 0 }])
        .select('id')
        .single()
      setBusy(false)
      if (insertError) {
        setError('Could not save: ' + insertError.message)
        return
      }
      setCurrentId(data.id)
      setName(newName)
    }
    setDirty(false)
    setNotice(asNew ? 'Saved as a new design.' : 'Design saved.')
    load()
  }

  const setAsDefault = async () => {
    if (!event || !currentId) return
    setBusy(true)
    await supabase.from('badge_designs').update({ is_default: false }).eq('event_id', event.id).neq('id', currentId)
    const { error: updateError } = await supabase.from('badge_designs').update({ is_default: true }).eq('id', currentId)
    setBusy(false)
    if (updateError) setError('Could not set the default: ' + updateError.message)
    else setNotice('This design is now used for printing.')
    load()
  }

  const deleteDesign = async () => {
    if (!currentId) return
    const current = designs.find((d) => d.id === currentId)
    if (!confirm(`Delete the design "${current?.name}"? This cannot be undone.`)) return
    setBusy(true)
    const { error: deleteError } = await supabase.from('badge_designs').delete().eq('id', currentId)
    setBusy(false)
    if (deleteError) {
      setError('Could not delete: ' + deleteError.message)
      return
    }
    const list = await load()
    const next = list?.find((d) => d.is_default) ?? list?.[0]
    if (next) {
      // Keep one default for printing
      if (!next.is_default) await supabase.from('badge_designs').update({ is_default: true }).eq('id', next.id)
      openDesign(next)
    } else {
      newDesign()
    }
    setNotice('Design deleted.')
  }

  const newDesign = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    setCurrentId(null)
    setName(designs.length ? `Badge ${designs.length + 1}` : 'Default badge')
    setDesign(defaultDesign())
    setDirty(designs.length > 0)
    setSelectedId(null)
  }

  const restoreDefault = () => {
    if (!confirm('Replace this design with the default template? Unsaved changes are lost; save afterwards to keep it.')) return
    change(defaultDesign())
    setSelectedId(null)
  }

  const images: BadgeImages = useMemo(
    () => ({ eventLogoPath: event?.logo_path ?? null, orgLogoPath: event?.organizations?.logo_path ?? null }),
    [event]
  )

  const previewData = useMemo(() => {
    if (!event) return SAMPLE_BADGE_DATA
    const attendee = attendees.find((a) => a.id === previewId)
    return attendee ? badgeDataFor(attendee, event) : { ...SAMPLE_BADGE_DATA, ...pickEvent(badgeDataFor({ full_name: '', registration_id: '' }, event)) }
  }, [attendees, previewId, event])

  if (!event) return error ? <p className="alert-error">{error}</p> : <p>Loading badge designer...</p>

  const fitScale = Math.min(560 / design.widthMm, 480 / design.heightMm)
  const scale = fitScale * zoom
  const currentSaved = designs.find((d) => d.id === currentId)
  const folder = `${event.organization_id}/events/${event.id}/badge`

  return (
    <div style={{ maxWidth: '1400px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Badge Design</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {event.name} • Drag elements to move them, drag the blue corner to resize, or use the exact values on the right.
          </p>
        </div>
        <Link href={`/events/${event.id}/badges`} className="btn-secondary">Go to Badge Printing →</Link>
      </div>

      {!isAdmin && <div className="alert-warning" style={{ marginBottom: '16px' }}>Only owners and managers can save badge designs.</div>}

      {/* Design selection and saving */}
      <div style={{ ...section, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={label} htmlFor="design-select">Design</label>
          <select
            id="design-select"
            className="input-field"
            value={currentId ?? ''}
            onChange={(e) => {
              const d = designs.find((x) => x.id === e.target.value)
              if (d && (!dirty || confirm('Discard unsaved changes?'))) openDesign(d)
            }}
          >
            {!currentId && <option value="">{name} (not saved yet)</option>}
            {designs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_default ? ' — used for printing' : ''}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={label} htmlFor="design-name">Name</label>
          <input id="design-name" className="input-field" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => save()} disabled={busy || !isAdmin}>{busy ? 'Saving...' : dirty ? 'Save design' : 'Saved'}</button>
          <button className="btn-secondary" onClick={() => save(true)} disabled={busy || !isAdmin}>Duplicate</button>
          {currentSaved && !currentSaved.is_default && (
            <button className="btn-secondary" onClick={setAsDefault} disabled={busy || !isAdmin}>Use for printing</button>
          )}
          <button className="btn-secondary" onClick={newDesign} disabled={busy}>New design</button>
          <button className="btn-secondary" onClick={restoreDefault} disabled={busy}>Restore default</button>
          {currentId && (
            <button className="btn-secondary" onClick={deleteDesign} disabled={busy || !isAdmin} style={{ color: 'var(--color-error-red)' }}>Delete</button>
          )}
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {notice && <div className="alert-success" style={{ marginBottom: '16px' }}>{notice}</div>}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Live preview */}
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div style={{ padding: '24px', backgroundColor: 'var(--color-neutral-light)', borderRadius: '8px', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
            <BadgePreview
              design={design}
              data={previewData}
              images={images}
              scale={scale}
              editable
              selectedId={selectedId}
              onSelect={setSelectedId}
              onElementChange={updateElement}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
            <label style={{ fontSize: '14px', display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 240px' }}>
              Preview with
              <select className="input-field" value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
                <option value="">Sample attendee</option>
                {attendees.map((a) => <option key={a.id} value={a.id}>{a.full_name} ({a.registration_id})</option>)}
              </select>
            </label>
            <label style={{ fontSize: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              Zoom
              <input type="range" min={0.5} max={2} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {round(design.widthMm)} × {round(design.heightMm)} mm • Arrow keys nudge (Shift = 5 mm), Delete removes
            </span>
          </div>
        </div>

        {/* Editing panel */}
        <div style={{ flex: '1 1 340px', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <BadgeSettings design={design} change={change} folder={folder} />

          <div style={section}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Add element</h2>
            <AddField onAdd={(field) => addElement(textElement({ ...centred(60, 10), field, size: 14 }))} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={small} className="btn-secondary" onClick={() => addElement(textElement({ ...centred(60, 8), source: 'static', text: 'Text', size: 12 }))}>+ Static text</button>
              <button style={small} className="btn-secondary" onClick={() => addElement({ id: newElementId(), type: 'image', ...centred(24, 16), source: 'event_logo', path: null, label: 'Event logo', keepAspect: true })}>+ Event logo</button>
              <button style={small} className="btn-secondary" onClick={() => addElement({ id: newElementId(), type: 'image', ...centred(24, 16), source: 'org_logo', path: null, label: 'Organizer logo', keepAspect: true })}>+ Organizer logo</button>
              <UploadButton
                text="+ Sponsor logo"
                rules={LOGO_RULES}
                folder={folder}
                kind="sponsor"
                onUploaded={(path) => addElement({ id: newElementId(), type: 'image', ...centred(24, 12), source: 'sponsor', path, label: 'Sponsor logo', keepAspect: true })}
                onError={setError}
              />
              <button style={small} className="btn-secondary" onClick={() => addElement({ id: newElementId(), type: 'qr', ...centred(18, 18), color: '#111827' })}>+ QR code</button>
              <button style={small} className="btn-secondary" onClick={() => addElement({ id: newElementId(), type: 'rect', ...centred(40, 10), fill: '#10b981', stroke: null, strokeWidth: 0, radius: 0 })}>+ Shape</button>
            </div>
            {!images.eventLogoPath && !images.orgLogoPath && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                No event or organizer logo yet. Add one under <Link href={`/events/${event.id}/edit`} style={{ textDecoration: 'underline' }}>Edit Event</Link> or <Link href="/organization" style={{ textDecoration: 'underline' }}>Organization</Link>.
              </p>
            )}
          </div>

          <div style={section}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Layers <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--color-text-secondary)' }}>(top of list is drawn on top)</span></h2>
            {design.elements.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>No elements.</p>}
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[...design.elements].reverse().map((el) => (
                <li key={el.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', borderRadius: '4px', backgroundColor: el.id === selectedId ? 'var(--color-neutral-light)' : undefined }}>
                  <button onClick={() => setSelectedId(el.id)} style={{ flex: 1, textAlign: 'left', background: 'none', color: 'inherit', fontSize: '13px', padding: '6px 4px', fontWeight: el.id === selectedId ? 600 : 400 }}>
                    {elementName(el)}
                  </button>
                  <button title="Bring forward" aria-label="Bring forward" className="btn-secondary" style={{ ...small, padding: '4px 8px' }} onClick={() => moveLayer(el.id, 1)}>↑</button>
                  <button title="Send backward" aria-label="Send backward" className="btn-secondary" style={{ ...small, padding: '4px 8px' }} onClick={() => moveLayer(el.id, -1)}>↓</button>
                  <button title="Duplicate" aria-label="Duplicate" className="btn-secondary" style={{ ...small, padding: '4px 8px' }} onClick={() => duplicateElement(el)}>⧉</button>
                  <button title="Remove" aria-label="Remove" className="btn-secondary" style={{ ...small, padding: '4px 8px', color: 'var(--color-error-red)' }} onClick={() => removeElement(el.id)}>✕</button>
                </li>
              ))}
            </ul>
          </div>

          {selected && (
            <ElementProperties key={selected.id} el={selected} design={design} onChange={updateElement} folder={folder} onError={setError} />
          )}
        </div>
      </div>
    </div>
  )
}

// Event fields of the sample data come from the real event
function pickEvent(d: ReturnType<typeof badgeDataFor>) {
  return { event_name: d.event_name, event_date: d.event_date, event_location: d.event_location }
}

function NumberInput({ id, value, onChange, min, max, step = 0.5, suffix }: { id: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type="number"
        className="input-field"
        value={round(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(min !== undefined && max !== undefined ? Math.min(max, Math.max(min, v)) : v)
        }}
        style={{ paddingRight: suffix ? '36px' : undefined }}
      />
      {suffix && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{suffix}</span>}
    </div>
  )
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', height: '40px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'none' }} />
}

function UploadButton({ text, rules, folder, kind, onUploaded, onError }: { text: string; rules: ImageRules; folder: string; kind: string; onUploaded: (path: string) => void; onError: (msg: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const choose = async (file?: File) => {
    if (ref.current) ref.current.value = ''
    if (!file) return
    const check = await validateImageFile(file, rules)
    if (!check.ok) {
      onError(check.error)
      return
    }
    setBusy(true)
    try {
      onUploaded(await uploadImage('branding', folder, kind, file, check.type))
    } catch (err) {
      onError('Upload failed: ' + (err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button style={small} className="btn-secondary" onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading...' : text}</button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => choose(e.target.files?.[0])} aria-label={text} />
    </>
  )
}

function AddField({ onAdd }: { onAdd: (field: TextElement['field']) => void }) {
  const [field, setField] = useState<TextElement['field']>('full_name')
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <select className="input-field" value={field} onChange={(e) => setField(e.target.value as TextElement['field'])} aria-label="Attendee field">
        {BADGE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <button className="btn-secondary" style={{ ...small, whiteSpace: 'nowrap' }} onClick={() => onAdd(field)}>+ Add field</button>
    </div>
  )
}

function BadgeSettings({ design, change, folder }: { design: BadgeDesign; change: (d: BadgeDesign) => void; folder: string }) {
  const [error, setError] = useState('')
  const presetIndex = SIZE_PRESETS.findIndex((p) => Math.abs(p.w - design.widthMm) < 0.2 && Math.abs(p.h - design.heightMm) < 0.2)
  const landscape = design.widthMm >= design.heightMm

  return (
    <div style={section}>
      <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Badge</h2>
      <div>
        <label style={label} htmlFor="size-preset">Size</label>
        <select
          id="size-preset"
          className="input-field"
          value={presetIndex}
          onChange={(e) => {
            const p = SIZE_PRESETS[Number(e.target.value)]
            if (p) change(resizeDesign(design, p.w, p.h))
          }}
        >
          {presetIndex === -1 && <option value={-1}>Custom</option>}
          {SIZE_PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={label} htmlFor="badge-w">Width</label>
          <NumberInput id="badge-w" value={design.widthMm} min={LIMITS.minSide} max={LIMITS.maxSide} suffix="mm" onChange={(v) => change(resizeDesign(design, v, design.heightMm))} />
        </div>
        <div>
          <label style={label} htmlFor="badge-h">Height</label>
          <NumberInput id="badge-h" value={design.heightMm} min={LIMITS.minSide} max={LIMITS.maxSide} suffix="mm" onChange={(v) => change(resizeDesign(design, design.widthMm, v))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className={landscape ? 'btn-primary' : 'btn-secondary'} style={{ ...small, flex: 1 }} onClick={() => !landscape && change(rotateDesign(design))}>Landscape</button>
        <button className={!landscape ? 'btn-primary' : 'btn-secondary'} style={{ ...small, flex: 1 }} onClick={() => landscape && change(rotateDesign(design))}>Portrait</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={label} htmlFor="bg-color">Background</label>
          <ColorInput id="bg-color" value={design.background.color} onChange={(v) => change({ ...design, background: { ...design.background, color: v } })} />
        </div>
        <div>
          <span style={label}>Background image</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <UploadButton
              text={design.background.imagePath ? 'Replace' : 'Upload'}
              rules={BADGE_BACKGROUND_RULES}
              folder={folder}
              kind="background"
              onUploaded={(path) => change({ ...design, background: { ...design.background, imagePath: path } })}
              onError={setError}
            />
            {design.background.imagePath && (
              <button style={{ ...small, color: 'var(--color-error-red)' }} className="btn-secondary" onClick={() => change({ ...design, background: { ...design.background, imagePath: null } })}>Remove</button>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div>
          <label style={label} htmlFor="border-w">Border</label>
          <NumberInput id="border-w" value={design.border.width} min={0} max={10} step={0.25} suffix="mm" onChange={(v) => change({ ...design, border: { ...design.border, width: v } })} />
        </div>
        <div>
          <label style={label} htmlFor="border-c">Border colour</label>
          <ColorInput id="border-c" value={design.border.color} onChange={(v) => change({ ...design, border: { ...design.border, color: v } })} />
        </div>
        <div>
          <label style={label} htmlFor="border-r">Corners</label>
          <NumberInput id="border-r" value={design.border.radius} min={0} max={30} suffix="mm" onChange={(v) => change({ ...design, border: { ...design.border, radius: v } })} />
        </div>
      </div>
      {error && <div className="alert-error" style={{ fontSize: '13px' }}>{error}</div>}
    </div>
  )
}

function ElementProperties({ el, design, onChange, folder, onError }: { el: BadgeElement; design: BadgeDesign; onChange: (el: BadgeElement) => void; folder: string; onError: (m: string) => void }) {
  const set = (patch: Partial<BadgeElement>) => onChange({ ...el, ...patch } as BadgeElement)
  const lockRatio = el.type === 'image' && el.keepAspect
  const setW = (w: number) => set(lockRatio ? { w, h: round((w * el.h) / el.w) } : el.type === 'qr' ? { w, h: w } : { w })
  const setH = (h: number) => set(lockRatio ? { h, w: round((h * el.w) / el.h) } : el.type === 'qr' ? { w: h, h } : { h })

  return (
    <div style={section}>
      <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{elementName(el)}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
        <div><label style={label} htmlFor="el-x">X</label><NumberInput id="el-x" value={el.x} onChange={(x) => set({ x })} /></div>
        <div><label style={label} htmlFor="el-y">Y</label><NumberInput id="el-y" value={el.y} onChange={(y) => set({ y })} /></div>
        <div><label style={label} htmlFor="el-w">Width</label><NumberInput id="el-w" value={el.w} min={2} max={LIMITS.maxSide} onChange={setW} /></div>
        <div><label style={label} htmlFor="el-h">Height</label><NumberInput id="el-h" value={el.h} min={2} max={LIMITS.maxSide} onChange={setH} /></div>
      </div>
      <div>
        <span style={label}>Align on badge</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={small} onClick={() => set({ x: 0 })}>Left</button>
          <button className="btn-secondary" style={small} onClick={() => set({ x: round((design.widthMm - el.w) / 2) })}>Centre</button>
          <button className="btn-secondary" style={small} onClick={() => set({ x: round(design.widthMm - el.w) })}>Right</button>
          <button className="btn-secondary" style={small} onClick={() => set({ y: 0 })}>Top</button>
          <button className="btn-secondary" style={small} onClick={() => set({ y: round((design.heightMm - el.h) / 2) })}>Middle</button>
          <button className="btn-secondary" style={small} onClick={() => set({ y: round(design.heightMm - el.h) })}>Bottom</button>
          <button className="btn-secondary" style={small} onClick={() => set({ x: 0, w: design.widthMm })}>Full width</button>
        </div>
      </div>

      {el.type === 'text' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={label} htmlFor="el-source">Content</label>
              <select id="el-source" className="input-field" value={el.source === 'static' ? '__static' : el.field} onChange={(e) => set(e.target.value === '__static' ? { source: 'static' } : { source: 'field', field: e.target.value as TextElement['field'] })}>
                {BADGE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                <option value="__static">Static text</option>
              </select>
            </div>
            <div>
              <label style={label} htmlFor="el-font">Font</label>
              <select id="el-font" className="input-field" value={el.font} onChange={(e) => set({ font: e.target.value as TextElement['font'] })}>
                <option value="helvetica">Helvetica (sans)</option>
                <option value="times">Times (serif)</option>
                <option value="courier">Courier (mono)</option>
              </select>
            </div>
          </div>
          {el.source === 'static' && (
            <div>
              <label style={label} htmlFor="el-text">Text</label>
              <input id="el-text" className="input-field" value={el.text} maxLength={200} onChange={(e) => set({ text: e.target.value })} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div><label style={label} htmlFor="el-size">Size</label><NumberInput id="el-size" value={el.size} min={LIMITS.minFont} max={LIMITS.maxFont} step={1} suffix="pt" onChange={(size) => set({ size })} /></div>
            <div><label style={label} htmlFor="el-min">Shrink to</label><NumberInput id="el-min" value={el.minSize} min={LIMITS.minFont} max={LIMITS.maxFont} step={1} suffix="pt" onChange={(minSize) => set({ minSize })} /></div>
            <div><label style={label} htmlFor="el-color">Colour</label><ColorInput id="el-color" value={el.color} onChange={(color) => set({ color })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={el.align === a ? 'btn-primary' : 'btn-secondary'} style={small} onClick={() => set({ align: a })}>{a === 'center' ? 'Centre' : a[0]!.toUpperCase() + a.slice(1)}</button>
            ))}
            <button className={el.bold ? 'btn-primary' : 'btn-secondary'} style={{ ...small, fontWeight: 700 }} onClick={() => set({ bold: !el.bold })}>Bold</button>
            <button className={el.italic ? 'btn-primary' : 'btn-secondary'} style={{ ...small, fontStyle: 'italic' }} onClick={() => set({ italic: !el.italic })}>Italic</button>
            <button className={el.uppercase ? 'btn-primary' : 'btn-secondary'} style={small} onClick={() => set({ uppercase: !el.uppercase })}>ABC</button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Long text shrinks down to the &quot;Shrink to&quot; size, then wraps onto more lines inside the box.</p>
        </>
      )}

      {el.type === 'image' && (
        <>
          <div>
            <label style={label} htmlFor="el-label">Label</label>
            <input id="el-label" className="input-field" value={el.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
            <input type="checkbox" checked={el.keepAspect} onChange={(e) => set({ keepAspect: e.target.checked } as Partial<ImageElement>)} />
            Keep aspect ratio (unlock to stretch the image to the box)
          </label>
          {el.source === 'sponsor' ? (
            <UploadButton text="Replace logo" rules={LOGO_RULES} folder={folder} kind="sponsor" onUploaded={(path) => set({ path } as Partial<ImageElement>)} onError={onError} />
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {el.source === 'event_logo' ? 'Uses the event logo (or the organizer logo if the event has none).' : 'Uses the organizer company logo.'}
            </p>
          )}
        </>
      )}

      {el.type === 'qr' && (
        <div>
          <label style={label} htmlFor="el-qr">QR colour</label>
          <ColorInput id="el-qr" value={el.color} onChange={(color) => set({ color })} />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Encodes the attendee&apos;s registration ID. Keep it dark on a light background so scanners can read it.</p>
        </div>
      )}

      {el.type === 'rect' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={label} htmlFor="el-fill">Fill</label>
            <ColorInput id="el-fill" value={el.fill ?? '#ffffff'} onChange={(fill) => set({ fill } as Partial<RectElement>)} />
            <label style={{ fontSize: '12px', display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input type="checkbox" checked={!el.fill} onChange={(e) => set({ fill: e.target.checked ? null : '#10b981' } as Partial<RectElement>)} /> No fill
            </label>
          </div>
          <div>
            <label style={label} htmlFor="el-stroke">Outline</label>
            <ColorInput id="el-stroke" value={el.stroke ?? '#111827'} onChange={(stroke) => set({ stroke, strokeWidth: el.strokeWidth || 0.5 } as Partial<RectElement>)} />
            <label style={{ fontSize: '12px', display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input type="checkbox" checked={!el.stroke} onChange={(e) => set({ stroke: e.target.checked ? null : '#111827', strokeWidth: el.strokeWidth || 0.5 } as Partial<RectElement>)} /> No outline
            </label>
          </div>
          <div><label style={label} htmlFor="el-sw">Outline width</label><NumberInput id="el-sw" value={el.strokeWidth} min={0} max={10} step={0.25} suffix="mm" onChange={(strokeWidth) => set({ strokeWidth } as Partial<RectElement>)} /></div>
          <div><label style={label} htmlFor="el-radius">Corners</label><NumberInput id="el-radius" value={el.radius} min={0} max={50} suffix="mm" onChange={(radius) => set({ radius } as Partial<RectElement>)} /></div>
        </div>
      )}
    </div>
  )
}
