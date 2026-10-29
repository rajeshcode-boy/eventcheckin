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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfirm } from '@/components/ConfirmDialog'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

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

const label = 'mb-1 block text-[13px] font-medium'
const section = 'flex flex-col gap-2.5 rounded-md border border-border p-3'
const round = (v: number) => Math.round(v * 10) / 10

function elementName(el: BadgeElement): string {
  if (el.type === 'text') return el.source === 'static' ? `Text: ${el.text || '(empty)'}` : BADGE_FIELDS.find((f) => f.value === el.field)?.label ?? 'Text'
  if (el.type === 'image') return el.label || (el.source === 'event_logo' ? 'Event logo' : el.source === 'org_logo' ? 'Organizer logo' : 'Sponsor logo')
  if (el.type === 'qr') return 'QR code (registration ID)'
  return 'Rectangle'
}

export default function BadgeDesignPage() {
  const { confirm, dialog } = useConfirm()
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const role = useEventRole()
  const [tab, setTab] = useState<'canvas' | 'branding' | 'fields'>('canvas')
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
    if (!(await confirm({ title: `Delete the design "${current?.name}"?`, description: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true }))) return
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

  const newDesign = async () => {
    if (dirty && !(await confirm({ title: 'Discard unsaved changes?', confirmLabel: 'Discard', destructive: true }))) return
    setCurrentId(null)
    setName(designs.length ? `Badge ${designs.length + 1}` : 'Default badge')
    setDesign(defaultDesign())
    setDirty(designs.length > 0)
    setSelectedId(null)
  }

  const restoreDefault = async () => {
    if (!(await confirm({ title: 'Replace this design with the default template?', description: 'Unsaved changes are lost. Save afterwards to keep it.', confirmLabel: 'Replace', destructive: true }))) return
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

  // Picking an element on the canvas opens the Fields tab, where its properties are
  useEffect(() => {
    if (selectedId) setTab('fields')
  }, [selectedId])

  if (!event) return error ? <Alert variant="error">{error}</Alert> : <p>Loading badge designer...</p>

  const fitScale = Math.min(560 / design.widthMm, 480 / design.heightMm)
  const scale = fitScale * zoom
  const currentSaved = designs.find((d) => d.id === currentId)
  const folder = `${event.organization_id}/events/${event.id}/badge`

  return (
    <>
    {dialog}
    <div className="max-w-[1400px]">

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-[28px] font-bold">Badge Design</h1>
          <p className="text-muted-foreground">
            {event.name} • Drag elements to move them, drag the blue corner to resize, or type exact values in the panel.
          </p>
        </div>
        <Button variant="outline" render={<Link href={`/events/${event.id}/badges`} />} nativeButton={false}>Go to Badge Printing →</Button>
      </div>

      {!isAdmin && <Alert variant="warning" className="mb-4">Only owners and managers can save badge designs.</Alert>}

      {/* Design selection and saving */}
      <div className={cn(section, 'mb-4 flex-row flex-wrap items-end')}>
        <div className="flex-1 basis-[200px]">
          <label className={label} htmlFor="design-select">Design</label>
          <NativeSelect
            id="design-select"
            className="h-10"
            value={currentId ?? ''}
            onChange={async (e) => {
              const d = designs.find((x) => x.id === e.target.value)
              if (d && (!dirty || (await confirm({ title: 'Discard unsaved changes?', confirmLabel: 'Discard', destructive: true })))) openDesign(d)
            }}
          >
            {!currentId && <option value="">{name} (not saved yet)</option>}
            {designs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_default ? ' — used for printing' : ''}</option>)}
          </NativeSelect>
        </div>
        <div className="flex-1 basis-[200px]">
          <label className={label} htmlFor="design-name">Name</label>
          <Input id="design-name" className="h-10" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDirty(true) }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button  onClick={() => save()} disabled={busy || !isAdmin}>{busy ? 'Saving...' : dirty ? 'Save design' : 'Saved'}</Button>
          <Button variant="outline" onClick={() => save(true)} disabled={busy || !isAdmin}>Duplicate</Button>
          {currentSaved && !currentSaved.is_default && (
            <Button variant="outline" onClick={setAsDefault} disabled={busy || !isAdmin}>Use for printing</Button>
          )}
          <Button variant="outline" onClick={newDesign} disabled={busy}>New design</Button>
          <Button variant="outline" onClick={restoreDefault} disabled={busy}>Restore default</Button>
          {currentId && (
            <Button variant="outline" className="text-destructive" onClick={deleteDesign} disabled={busy || !isAdmin}>Delete</Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}

      {/* Workbench: controls scroll on their own on the left, the preview stays in view on the right */}
      <div className="grid gap-6 lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-5.5rem)] lg:min-h-[28rem] lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <div className="order-2 min-h-0 lg:order-1 lg:overflow-y-auto lg:pr-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList variant="line" aria-label="Badge controls" className="sticky top-0 z-10 w-full justify-start bg-background">
              <TabsTrigger value="canvas" className="flex-none px-3">Canvas size</TabsTrigger>
              <TabsTrigger value="branding" className="flex-none px-3">Branding</TabsTrigger>
              <TabsTrigger value="fields" className="flex-none px-3">Fields{design.elements.length ? ` (${design.elements.length})` : ''}</TabsTrigger>
            </TabsList>

            <TabsContent value="canvas" className="grid gap-3 pt-3">
              <CanvasSettings design={design} change={change} />
            </TabsContent>

            <TabsContent value="branding" className="grid gap-3 pt-3">
              <BrandingSettings design={design} change={change} folder={folder} />
            </TabsContent>

            <TabsContent value="fields" className="grid gap-3 pt-3">
            <div className={section}>
              <h2 className="text-base font-semibold">Add element</h2>
              <AddField onAdd={(field) => addElement(textElement({ ...centred(60, 10), field, size: 14 }))} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addElement(textElement({ ...centred(60, 8), source: 'static', text: 'Text', size: 12 }))}>+ Static text</Button>
                <Button size="sm" variant="outline" onClick={() => addElement({ id: newElementId(), type: 'image', ...centred(24, 16), source: 'event_logo', path: null, label: 'Event logo', keepAspect: true })}>+ Event logo</Button>
                <Button size="sm" variant="outline" onClick={() => addElement({ id: newElementId(), type: 'image', ...centred(24, 16), source: 'org_logo', path: null, label: 'Organizer logo', keepAspect: true })}>+ Organizer logo</Button>
                <UploadButton
                  text="+ Sponsor logo"
                  rules={LOGO_RULES}
                  folder={folder}
                  kind="sponsor"
                  onUploaded={(path) => addElement({ id: newElementId(), type: 'image', ...centred(24, 12), source: 'sponsor', path, label: 'Sponsor logo', keepAspect: true })}
                  onError={setError}
                />
                <Button size="sm" variant="outline" onClick={() => addElement({ id: newElementId(), type: 'qr', ...centred(18, 18), color: '#111827' })}>+ QR code</Button>
                <Button size="sm" variant="outline" onClick={() => addElement({ id: newElementId(), type: 'rect', ...centred(40, 10), fill: '#10b981', stroke: null, strokeWidth: 0, radius: 0 })}>+ Shape</Button>
              </div>
              {!images.eventLogoPath && !images.orgLogoPath && (
                <p className="text-xs text-muted-foreground">
                  No event or organizer logo yet. Add one under <Link href={`/events/${event.id}/edit`} className="underline">Edit Event</Link> or <Link href="/organization" className="underline">Organization</Link>.
                </p>
              )}
            </div>

            <div className={section}>
              <h2 className="text-base font-semibold">Layers <span className="text-[13px] font-normal text-muted-foreground">(top of list is drawn on top)</span></h2>
              {design.elements.length === 0 && <p className="text-[13px] text-muted-foreground">No elements.</p>}
              <ul className="flex flex-col gap-1">
                {[...design.elements].reverse().map((el) => (
                  <li key={el.id} className={cn('flex items-center gap-1 rounded px-1.5 py-1', el.id === selectedId && 'bg-muted')}>
                    <button type="button" onClick={() => setSelectedId(el.id)} className={cn('flex-1 bg-transparent px-1 py-1.5 text-left text-[13px] text-inherit', el.id === selectedId ? 'font-semibold' : 'font-normal')}>
                      {elementName(el)}
                    </button>
                    <Button title="Bring forward" aria-label="Bring forward" variant="outline" size="sm" className="px-2" onClick={() => moveLayer(el.id, 1)}>↑</Button>
                    <Button title="Send backward" aria-label="Send backward" variant="outline" size="sm" className="px-2" onClick={() => moveLayer(el.id, -1)}>↓</Button>
                    <Button title="Duplicate" aria-label="Duplicate" variant="outline" size="sm" className="px-2" onClick={() => duplicateElement(el)}>⧉</Button>
                    <Button title="Remove" aria-label="Remove" variant="outline" size="sm" className="px-2 text-destructive" onClick={() => removeElement(el.id)}>✕</Button>
                  </li>
                ))}
              </ul>
            </div>

            {selected && (
              <ElementProperties key={selected.id} el={selected} design={design} onChange={updateElement} folder={folder} onError={setError} />
            )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="order-1 min-h-0 lg:order-2 lg:overflow-y-auto">
          <div className="flex justify-center overflow-auto rounded-lg bg-muted p-6">
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex flex-1 basis-60 items-center gap-2 text-sm">
              Preview with
              <NativeSelect className="h-10" value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
                <option value="">Sample attendee</option>
                {attendees.map((a) => <option key={a.id} value={a.id}>{a.full_name} ({a.registration_id})</option>)}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Zoom
              <input type="range" min={0.5} max={2} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            <span className="text-[13px] text-muted-foreground">
              {round(design.widthMm)} × {round(design.heightMm)} mm • Arrow keys nudge (Shift = 5 mm), Delete removes
            </span>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

// Event fields of the sample data come from the real event
function pickEvent(d: ReturnType<typeof badgeDataFor>) {
  return { event_name: d.event_name, event_date: d.event_date, event_location: d.event_location }
}

function NumberInput({ id, value, onChange, min, max, step = 0.5, suffix }: { id: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        className={cn('h-10', suffix && 'pr-9')}
        value={round(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(min !== undefined && max !== undefined ? Math.min(max, Math.max(min, v)) : v)
        }}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  )
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-border bg-transparent" />
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
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>{busy ? 'Uploading...' : text}</Button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => choose(e.target.files?.[0])} aria-label={text} />
    </>
  )
}

function AddField({ onAdd }: { onAdd: (field: TextElement['field']) => void }) {
  const [field, setField] = useState<TextElement['field']>('full_name')
  return (
    <div className="flex gap-2">
      <NativeSelect className="h-10" value={field} onChange={(e) => setField(e.target.value as TextElement['field'])} aria-label="Attendee field">
        {BADGE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </NativeSelect>
      <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => onAdd(field)}>+ Add field</Button>
    </div>
  )
}

function CanvasSettings({ design, change }: { design: BadgeDesign; change: (d: BadgeDesign) => void }) {
  const presetIndex = SIZE_PRESETS.findIndex((p) => Math.abs(p.w - design.widthMm) < 0.2 && Math.abs(p.h - design.heightMm) < 0.2)
  const landscape = design.widthMm >= design.heightMm

  return (
    <div className={section}>
      <h2 className="text-base font-semibold">Canvas size</h2>
      <div>
        <label className={label} htmlFor="size-preset">Size</label>
        <NativeSelect
          id="size-preset"
          className="h-10"
          value={presetIndex}
          onChange={(e) => {
            const p = SIZE_PRESETS[Number(e.target.value)]
            if (p) change(resizeDesign(design, p.w, p.h))
          }}
        >
          {presetIndex === -1 && <option value={-1}>Custom</option>}
          {SIZE_PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="badge-w">Width</label>
          <NumberInput id="badge-w" value={design.widthMm} min={LIMITS.minSide} max={LIMITS.maxSide} suffix="mm" onChange={(v) => change(resizeDesign(design, v, design.heightMm))} />
        </div>
        <div>
          <label className={label} htmlFor="badge-h">Height</label>
          <NumberInput id="badge-h" value={design.heightMm} min={LIMITS.minSide} max={LIMITS.maxSide} suffix="mm" onChange={(v) => change(resizeDesign(design, design.widthMm, v))} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant={landscape ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => !landscape && change(rotateDesign(design))}>Landscape</Button>
        <Button variant={!landscape ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => landscape && change(rotateDesign(design))}>Portrait</Button>
      </div>
    </div>
  )
}

function BrandingSettings({ design, change, folder }: { design: BadgeDesign; change: (d: BadgeDesign) => void; folder: string }) {
  const [error, setError] = useState('')

  return (
    <div className={section}>
      <h2 className="text-base font-semibold">Branding</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="bg-color">Background</label>
          <ColorInput id="bg-color" value={design.background.color} onChange={(v) => change({ ...design, background: { ...design.background, color: v } })} />
        </div>
        <div>
          <span className={label}>Background image</span>
          <div className="flex flex-wrap gap-1.5">
            <UploadButton
              text={design.background.imagePath ? 'Replace' : 'Upload'}
              rules={BADGE_BACKGROUND_RULES}
              folder={folder}
              kind="background"
              onUploaded={(path) => change({ ...design, background: { ...design.background, imagePath: path } })}
              onError={setError}
            />
            {design.background.imagePath && (
              <Button size="sm" className="text-destructive" variant="outline" onClick={() => change({ ...design, background: { ...design.background, imagePath: null } })}>Remove</Button>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={label} htmlFor="border-w">Border</label>
          <NumberInput id="border-w" value={design.border.width} min={0} max={10} step={0.25} suffix="mm" onChange={(v) => change({ ...design, border: { ...design.border, width: v } })} />
        </div>
        <div>
          <label className={label} htmlFor="border-c">Border colour</label>
          <ColorInput id="border-c" value={design.border.color} onChange={(v) => change({ ...design, border: { ...design.border, color: v } })} />
        </div>
        <div>
          <label className={label} htmlFor="border-r">Corners</label>
          <NumberInput id="border-r" value={design.border.radius} min={0} max={30} suffix="mm" onChange={(v) => change({ ...design, border: { ...design.border, radius: v } })} />
        </div>
      </div>
      {error && <Alert variant="error" className="text-[13px]">{error}</Alert>}
    </div>
  )
}

function ElementProperties({ el, design, onChange, folder, onError }: { el: BadgeElement; design: BadgeDesign; onChange: (el: BadgeElement) => void; folder: string; onError: (m: string) => void }) {
  const set = (patch: Partial<BadgeElement>) => onChange({ ...el, ...patch } as BadgeElement)
  const lockRatio = el.type === 'image' && el.keepAspect
  const setW = (w: number) => set(lockRatio ? { w, h: round((w * el.h) / el.w) } : el.type === 'qr' ? { w, h: w } : { w })
  const setH = (h: number) => set(lockRatio ? { h, w: round((h * el.w) / el.h) } : el.type === 'qr' ? { w: h, h } : { h })

  return (
    <div className={section}>
      <h2 className="text-base font-semibold">{elementName(el)}</h2>
      <div className="grid grid-cols-4 gap-2">
        <div><label className={label} htmlFor="el-x">X</label><NumberInput id="el-x" value={el.x} onChange={(x) => set({ x })} /></div>
        <div><label className={label} htmlFor="el-y">Y</label><NumberInput id="el-y" value={el.y} onChange={(y) => set({ y })} /></div>
        <div><label className={label} htmlFor="el-w">Width</label><NumberInput id="el-w" value={el.w} min={2} max={LIMITS.maxSide} onChange={setW} /></div>
        <div><label className={label} htmlFor="el-h">Height</label><NumberInput id="el-h" value={el.h} min={2} max={LIMITS.maxSide} onChange={setH} /></div>
      </div>
      <div>
        <span className={label}>Align on badge</span>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => set({ x: 0 })}>Left</Button>
          <Button variant="outline" size="sm" onClick={() => set({ x: round((design.widthMm - el.w) / 2) })}>Centre</Button>
          <Button variant="outline" size="sm" onClick={() => set({ x: round(design.widthMm - el.w) })}>Right</Button>
          <Button variant="outline" size="sm" onClick={() => set({ y: 0 })}>Top</Button>
          <Button variant="outline" size="sm" onClick={() => set({ y: round((design.heightMm - el.h) / 2) })}>Middle</Button>
          <Button variant="outline" size="sm" onClick={() => set({ y: round(design.heightMm - el.h) })}>Bottom</Button>
          <Button variant="outline" size="sm" onClick={() => set({ x: 0, w: design.widthMm })}>Full width</Button>
        </div>
      </div>

      {el.type === 'text' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="el-source">Content</label>
              <NativeSelect id="el-source" className="h-10" value={el.source === 'static' ? '__static' : el.field} onChange={(e) => set(e.target.value === '__static' ? { source: 'static' } : { source: 'field', field: e.target.value as TextElement['field'] })}>
                {BADGE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                <option value="__static">Static text</option>
              </NativeSelect>
            </div>
            <div>
              <label className={label} htmlFor="el-font">Font</label>
              <NativeSelect id="el-font" className="h-10" value={el.font} onChange={(e) => set({ font: e.target.value as TextElement['font'] })}>
                <option value="helvetica">Helvetica (sans)</option>
                <option value="times">Times (serif)</option>
                <option value="courier">Courier (mono)</option>
              </NativeSelect>
            </div>
          </div>
          {el.source === 'static' && (
            <div>
              <label className={label} htmlFor="el-text">Text</label>
              <Input id="el-text" className="h-10" value={el.text} maxLength={200} onChange={(e) => set({ text: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div><label className={label} htmlFor="el-size">Size</label><NumberInput id="el-size" value={el.size} min={LIMITS.minFont} max={LIMITS.maxFont} step={1} suffix="pt" onChange={(size) => set({ size })} /></div>
            <div><label className={label} htmlFor="el-min">Shrink to</label><NumberInput id="el-min" value={el.minSize} min={LIMITS.minFont} max={LIMITS.maxFont} step={1} suffix="pt" onChange={(minSize) => set({ minSize })} /></div>
            <div><label className={label} htmlFor="el-color">Colour</label><ColorInput id="el-color" value={el.color} onChange={(color) => set({ color })} /></div>
          </div>
          <div className="flex flex-wrap gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <Button key={a} variant={el.align === a ? 'default' : 'outline'} size="sm" onClick={() => set({ align: a })}>{a === 'center' ? 'Centre' : a[0]!.toUpperCase() + a.slice(1)}</Button>
            ))}
            <Button variant={el.bold ? 'default' : 'outline'} size="sm" className="font-bold" onClick={() => set({ bold: !el.bold })}>Bold</Button>
            <Button variant={el.italic ? 'default' : 'outline'} size="sm" className="italic" onClick={() => set({ italic: !el.italic })}>Italic</Button>
            <Button variant={el.uppercase ? 'default' : 'outline'} size="sm" onClick={() => set({ uppercase: !el.uppercase })}>ABC</Button>
          </div>
          <p className="text-xs text-muted-foreground">Long text shrinks down to the &quot;Shrink to&quot; size, then wraps onto more lines inside the box.</p>
        </>
      )}

      {el.type === 'image' && (
        <>
          <div>
            <label className={label} htmlFor="el-label">Label</label>
            <Input id="el-label" className="h-10" value={el.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={el.keepAspect} onChange={(e) => set({ keepAspect: e.target.checked } as Partial<ImageElement>)} />
            Keep aspect ratio (unlock to stretch the image to the box)
          </label>
          {el.source === 'sponsor' ? (
            <UploadButton text="Replace logo" rules={LOGO_RULES} folder={folder} kind="sponsor" onUploaded={(path) => set({ path } as Partial<ImageElement>)} onError={onError} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {el.source === 'event_logo' ? 'Uses the event logo (or the organizer logo if the event has none).' : 'Uses the organizer company logo.'}
            </p>
          )}
        </>
      )}

      {el.type === 'qr' && (
        <div>
          <label className={label} htmlFor="el-qr">QR colour</label>
          <ColorInput id="el-qr" value={el.color} onChange={(color) => set({ color })} />
          <p className="mt-1 text-xs text-muted-foreground">Encodes the attendee&apos;s registration ID. Keep it dark on a light background so scanners can read it.</p>
        </div>
      )}

      {el.type === 'rect' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor="el-fill">Fill</label>
            <ColorInput id="el-fill" value={el.fill ?? '#ffffff'} onChange={(fill) => set({ fill } as Partial<RectElement>)} />
            <label className="mt-1 flex gap-1.5 text-xs">
              <input type="checkbox" checked={!el.fill} onChange={(e) => set({ fill: e.target.checked ? null : '#10b981' } as Partial<RectElement>)} /> No fill
            </label>
          </div>
          <div>
            <label className={label} htmlFor="el-stroke">Outline</label>
            <ColorInput id="el-stroke" value={el.stroke ?? '#111827'} onChange={(stroke) => set({ stroke, strokeWidth: el.strokeWidth || 0.5 } as Partial<RectElement>)} />
            <label className="mt-1 flex gap-1.5 text-xs">
              <input type="checkbox" checked={!el.stroke} onChange={(e) => set({ stroke: e.target.checked ? null : '#111827', strokeWidth: el.strokeWidth || 0.5 } as Partial<RectElement>)} /> No outline
            </label>
          </div>
          <div><label className={label} htmlFor="el-sw">Outline width</label><NumberInput id="el-sw" value={el.strokeWidth} min={0} max={10} step={0.25} suffix="mm" onChange={(strokeWidth) => set({ strokeWidth } as Partial<RectElement>)} /></div>
          <div><label className={label} htmlFor="el-radius">Corners</label><NumberInput id="el-radius" value={el.radius} min={0} max={50} suffix="mm" onChange={(radius) => set({ radius } as Partial<RectElement>)} /></div>
        </div>
      )}
    </div>
  )
}
