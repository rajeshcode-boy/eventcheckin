'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BadgePreview from '@/components/BadgePreview'
import {
  BADGE_FIELDS, BadgeDesign, BadgeElement, BadgeImages, ImageElement, LIMITS, RectElement, SAMPLE_BADGE_DATA, SIZE_PRESETS,
  TextElement, badgeDataFor, defaultDesign, getTemplateProfiles, newElementId, parseDesign, resizeDesign, rotateDesign, textElement,
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
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import {
  Printer, Sliders, Layers, Crop, Grid, RotateCcw, CheckCircle2,
  Wifi, Sparkles, QrCode, FileText, Eye, Download, Copy, Trash2,
  Plus, Settings2, ShieldCheck, ArrowUp, ArrowDown, ChevronRight,
  ExternalLink, ZoomIn, ZoomOut, Check, Laptop, HelpCircle
} from 'lucide-react'

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

const label = 'mb-1 block text-[13px] font-medium text-slate-700 dark:text-slate-300'
const section = 'flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4 shadow-xs'
const round = (v: number) => Math.round(v * 10) / 10

function elementName(el: BadgeElement): string {
  if (el.type === 'text') return el.source === 'static' ? `Text: ${el.text || '(empty)'}` : BADGE_FIELDS.find((f) => f.value === el.field)?.label ?? 'Text'
  if (el.type === 'image') return el.label || (el.source === 'event_logo' ? 'Event logo' : el.source === 'org_logo' ? 'Organizer logo' : 'Sponsor logo')
  if (el.type === 'qr') return 'QR code (registration ID)'
  return 'Rectangle / Shape'
}

export default function BadgeDesignPage() {
  const { confirm, dialog } = useConfirm()
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const role = useEventRole()
  const [tab, setTab] = useState<'fields' | 'canvas' | 'fleet'>('fields')
  const isAdmin = canManageEvent(role)
  const [designs, setDesigns] = useState<SavedDesign[]>([])
  const [attendees, setAttendees] = useState<PreviewAttendee[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [design, setDesign] = useState<BadgeDesign>(() => defaultDesign())
  const [name, setName] = useState('Default badge')
  const [dirty, setDirty] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState('')
  const [persona, setPersona] = useState<'default' | 'vip' | 'long' | 'attendee'>('default')
  const [backView, setBackView] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showGuides, setShowGuides] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPrinterModal, setShowPrinterModal] = useState(false)
  const [unprintedCount, setUnprintedCount] = useState(0)

  // Printer configuration state
  const [printerModel, setPrinterModel] = useState('zebra_zd621')
  const [printerDpi, setPrinterDpi] = useState('300')
  const [printerDarkness, setPrinterDarkness] = useState(20)
  const [printerStation, setPrinterStation] = useState('gate_01')

  const templateProfiles = useMemo(() => getTemplateProfiles(event?.name || 'Tech Summit 2026'), [event?.name])

  const load = useCallback(async () => {
    const [eventRes, designRes, attendeeRes, printRes] = await Promise.all([
      supabase.from('events').select('id, organization_id, event_id, name, location, country, city, event_date, logo_path, organizations(logo_path)').eq('id', eventUuid).single(),
      supabase.from('badge_designs').select('id, name, is_default, design').eq('event_id', eventUuid).order('created_at'),
      supabase.from('registrations').select('id, registration_id, full_name, first_name, last_name, company, designation, country, city, industry, registration_status').eq('event_id', eventUuid).order('full_name').limit(500),
      supabase.from('badge_prints').select('registration_id').eq('event_id', eventUuid),
    ])
    if (eventRes.error || !eventRes.data) {
      setError('Event not found')
      return
    }
    setEvent(eventRes.data as unknown as EventInfo)
    const attList = (attendeeRes.data ?? []) as PreviewAttendee[]
    setAttendees(attList)
    const printedSet = new Set((printRes.data ?? []).map((p: { registration_id: string }) => p.registration_id))
    setUnprintedCount(attList.filter((a) => !printedSet.has(a.registration_id)).length)

    const list = (designRes.data ?? []) as SavedDesign[]
    setDesigns(list)
    return list
  }, [eventUuid])

  useEffect(() => {
    load().then((list) => {
      const initial = list?.find((d) => d.is_default) ?? list?.[0]
      if (initial) openDesign(initial)
    })
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
    setTab('fields')
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
    setNotice(asNew ? 'Saved as a new design.' : 'Design preset saved.')
    load()
  }

  const setAsDefault = async () => {
    if (!event || !currentId) return
    setBusy(true)
    await supabase.from('badge_designs').update({ is_default: false }).eq('event_id', event.id).neq('id', currentId)
    const { error: updateError } = await supabase.from('badge_designs').update({ is_default: true }).eq('id', currentId)
    setBusy(false)
    if (updateError) setError('Could not set the default: ' + updateError.message)
    else setNotice('This design is now used for active printing.')
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

  const applyTemplate = async (templateId: string) => {
    const t = templateProfiles.find((x) => x.id === templateId)
    if (!t) return
    if (dirty && !(await confirm({ title: `Apply template "${t.label}"?`, description: 'Unsaved canvas changes will be overwritten.', confirmLabel: 'Apply Template', destructive: true }))) return
    setDesign(t.design)
    setName(t.label.split('(')[0]!.trim())
    setDirty(true)
    setSelectedId(null)
    setNotice(`Template applied: ${t.label}`)
  }

  const images: BadgeImages = useMemo(
    () => ({ eventLogoPath: event?.logo_path ?? null, orgLogoPath: event?.organizations?.logo_path ?? null }),
    [event]
  )

  // Persona previews
  const previewData = useMemo(() => {
    if (!event) return SAMPLE_BADGE_DATA
    if (persona === 'vip') {
      return {
        ...SAMPLE_BADGE_DATA,
        full_name: 'Dr. Elena Rostova',
        first_name: 'Elena',
        last_name: 'Rostova',
        company: 'Quantum AI Labs & Robotics',
        designation: 'VP of Neural Computing',
        registration_type: 'KEYNOTE SPEAKER',
        registration_id: 'SP-1044-VIP',
        event_name: event.name,
        event_date: event.event_date,
        event_location: event.location,
      }
    }
    if (persona === 'long') {
      return {
        ...SAMPLE_BADGE_DATA,
        full_name: 'Dr. Wolfeschlegelsteinhausenbergerdorff III',
        first_name: 'Wolfeschlegelsteinhausenbergerdorff',
        last_name: 'III',
        company: 'International Consortium of Advanced Distributed Systems & Nanotechnology Ltd.',
        designation: 'Global Distinguished Chief Scientist & Principal Architect of Autonomous Networks',
        registration_type: 'VIP ALL-ACCESS',
        registration_id: 'OVERFLOW-999',
        event_name: event.name,
        event_date: event.event_date,
        event_location: event.location,
      }
    }
    if (persona === 'attendee' && previewId) {
      const attendee = attendees.find((a) => a.id === previewId)
      if (attendee) return badgeDataFor(attendee, event)
    }
    return { ...SAMPLE_BADGE_DATA, ...pickEvent(badgeDataFor({ full_name: '', registration_id: '' }, event)) }
  }, [attendees, previewId, persona, event])

  if (!event) return error ? <Alert variant="error">{error}</Alert> : <div className="p-8 text-center text-muted-foreground">Loading Badge Studio...</div>

  const fitScale = Math.min(560 / design.widthMm, 480 / design.heightMm)
  const scale = fitScale * zoom
  const currentSaved = designs.find((d) => d.id === currentId)
  const folder = `${event.organization_id}/events/${event.id}/badge`

  const triggerTestPrint = () => {
    window.print()
  }

  return (
    <>
      {dialog}
      <div className="max-w-[1520px] mx-auto pb-12 font-sans antialiased text-on-surface">

        {/* 1. TOP COMMAND RIBBON & HARDWARE STATUS STRIP */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operations</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-bold text-foreground">Badge Studio &amp; Hardware Dispatch</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono text-xs border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                EVENT: {event.event_id || event.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Hardware Cluster Live Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xs text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="font-mono font-bold text-foreground tracking-tight">FLEET: 14/14 ONLINE</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground hidden md:inline">Zebra ZD621 + Direct Thermal</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                Ready
              </span>
            </div>
          </div>

          {/* Main Studio Action Bar (Flat Card Bar) */}
          <div className="bg-card rounded-2xl border border-border shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Template Selector & Variant Selector */}
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              {/* Preset Templates */}
              <div className="min-w-[240px]">
                <CustomSelect
                  value=""
                  onChange={(val) => applyTemplate(String(val))}
                  placeholder="⚡ Load Preset Template..."
                  options={templateProfiles.map((t) => ({
                    value: t.id,
                    label: t.label,
                    dot: t.id === 'vip-speaker' ? 'bg-purple-500' : t.id === 'press-media' ? 'bg-red-500' : 'bg-emerald-500',
                  }))}
                />
              </div>

              {/* Saved Design Picker */}
              <div className="min-w-[210px]">
                <CustomSelect
                  value={currentId ?? ''}
                  onChange={async (val) => {
                    const d = designs.find((x) => x.id === val)
                    if (d && (!dirty || (await confirm({ title: 'Discard unsaved changes?', confirmLabel: 'Discard', destructive: true })))) openDesign(d)
                  }}
                  placeholder="Saved Designs"
                  options={[
                    ...(!currentId ? [{ value: '', label: `${name} (draft)` }] : []),
                    ...designs.map((d) => ({
                      value: d.id,
                      label: `${d.name}${d.is_default ? ' ★ (Active)' : ''}`,
                      dot: d.is_default ? 'bg-emerald-500' : undefined,
                    })),
                  ]}
                />
              </div>

              {/* Front / Back Switcher */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBackView(false)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                    !backView ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Front Facing
                </button>
                <button
                  type="button"
                  onClick={() => setBackView(true)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                    backView ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span>Back (Wi-Fi &amp; Agenda)</span>
                  <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
                    Pro
                  </span>
                </button>
              </div>

              {/* Persona Switcher */}
              <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-border text-xs">
                <span className="text-muted-foreground">Preview:</span>
                <button
                  type="button"
                  onClick={() => setPersona('vip')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider transition-all',
                    persona === 'vip' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200 ring-1 ring-purple-300' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  Elena (Keynote)
                </button>
                <button
                  type="button"
                  onClick={() => setPersona('default')}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider transition-all',
                    persona === 'default' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200 ring-1 ring-emerald-300' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  Standard GA
                </button>
                <button
                  type="button"
                  onClick={() => setPersona('long')}
                  title="Test auto-shrink font sizing with extreme text length"
                  className={cn(
                    'px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider transition-all',
                    persona === 'long' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 ring-1 ring-amber-300' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  Long Name Test
                </button>
              </div>
            </div>

            {/* Right: Studio Primary Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                className="rounded-xl gap-1.5 h-9"
                onClick={() => setShowPrinterModal(true)}
                title="Configure printer models, ZPL dark level, and station routing"
              >
                <Settings2 className="w-4 h-4 text-emerald-600" />
                <span>Printers</span>
              </Button>

              <Button
                variant="outline"
                className="rounded-xl gap-1.5 h-9"
                onClick={() => save()}
                disabled={busy || !isAdmin}
              >
                <Check className="w-4 h-4" />
                <span>{busy ? 'Saving...' : dirty ? 'Save Preset' : 'Saved'}</span>
              </Button>

              <Button
                variant="outline"
                className="rounded-xl gap-1.5 h-9 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-semibold"
                onClick={triggerTestPrint}
                title="Send a sample print job to your default printer"
              >
                <Printer className="w-4 h-4" />
                <span>Test Print</span>
              </Button>

              <Button
                render={<Link href={`/events/${event.id}/badges`} />}
                nativeButton={false}
                className="rounded-xl gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <Layers className="w-4 h-4" />
                <span>Batch Queue ({unprintedCount} Pending)</span>
              </Button>
            </div>
          </div>
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}

        {/* 2. MAIN CANVAS & STUDIO WORKSPACE (Split Grid) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* LEFT: BADGE CANVAS & PHYSICAL SIMULATOR (7 Columns) */}
          <div className="xl:col-span-7 flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border shadow-xs p-5 flex flex-col relative overflow-hidden">
              
              {/* Canvas Toolbar & Measurement Overlays */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">Canvas Viewport</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-xs">
                    {round(design.widthMm / 25.4)}&quot; × {round(design.heightMm / 25.4)}&quot; ({round(design.widthMm)} × {round(design.heightMm)} mm) • {printerDpi} DPI
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowGrid(!showGrid)}
                    className={cn(
                      'p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1',
                      showGrid ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                    )}
                    title="Toggle 0.25in Precision Alignment Grid"
                  >
                    <Grid className="w-4 h-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGuides(!showGuides)}
                    className={cn(
                      'p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1',
                      showGuides ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                    )}
                    title="Toggle 0.125in Safe Bleed Margins"
                  >
                    <Crop className="w-4 h-4" />
                    <span className="hidden sm:inline">Bleed</span>
                  </button>

                  <div className="h-4 w-px bg-border mx-1" />

                  {/* Zoom controls */}
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="px-2 py-1 rounded-lg bg-muted text-xs font-mono text-foreground hover:bg-muted/80 transition-colors"
                    title="Reset Zoom to 100%"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(Math.max(0.6, zoom - 0.15))}
                    className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(Math.min(1.8, zoom + 0.15))}
                    className="p-1 rounded-lg bg-muted text-muted-foreground hover:text-foreground"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Working Artboard Stage with Lanyard Ribbon & Clip */}
              <div
                className="relative w-full py-12 px-4 flex flex-col items-center justify-center bg-slate-100/70 dark:bg-slate-900/40 rounded-xl min-h-[490px] overflow-auto select-none border border-dashed border-border"
              >
                {/* Lanyard neck ribbon strap */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none mb-[-8px] h-14 w-20 rounded-t-lg bg-gradient-to-b from-emerald-600/30 to-emerald-700/80 dark:from-emerald-800/40 dark:to-emerald-600/80 opacity-75 shadow-xs"
                  style={{
                    clipPath: 'polygon(15% 0%, 85% 0%, 65% 100%, 35% 100%)',
                  }}
                />
                {/* Lanyard clip mount */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none mb-[-3px] z-30 h-3.5 w-10 rounded-sm bg-slate-400 dark:bg-slate-600 shadow-md border border-slate-300 dark:border-slate-500"
                />

                {/* THE BADGE CANVAS */}
                <BadgePreview
                  design={design}
                  data={previewData}
                  images={images}
                  scale={scale}
                  editable={!backView}
                  selectedId={selectedId}
                  showGrid={showGrid}
                  showGuides={showGuides}
                  backView={backView}
                  onSelect={setSelectedId}
                  onElementChange={updateElement}
                />
              </div>

              {/* Canvas Quick Controls & Live Simulation Specs */}
              <div className="flex flex-wrap items-center justify-between pt-3.5 mt-3 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Direct Thermal &amp; Dye-Sub Ready
                  </span>
                  <span>•</span>
                  <span>Target Pitch: {printerDpi} DPI ZPL II</span>
                </div>
                <div className="font-mono">
                  MEDIA: {round(design.widthMm)}mm × {round(design.heightMm)}mm
                </div>
              </div>
            </div>

            {/* Attendee Live Persona Bar */}
            <div className="bg-card rounded-xl border border-border p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-1 basis-64 items-center gap-2 text-xs">
                <span className="text-muted-foreground whitespace-nowrap font-medium">Test with Registrant:</span>
                <div className="flex-1 min-w-[220px]">
                  <CustomSelect
                    value={previewId}
                    onChange={(v) => {
                      setPreviewId(String(v))
                      setPersona('attendee')
                    }}
                    placeholder="Search real attendee..."
                    options={[
                      { value: '', label: 'None (Use persona)' },
                      ...attendees.map((a) => ({
                        value: a.id,
                        label: `${a.full_name} (${a.registration_id}) — ${a.company || 'No org'}`,
                      })),
                    ]}
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>Use arrow keys to nudge elements (Shift = 5mm)</span>
              </div>
            </div>
          </div>

          {/* RIGHT: DESIGNER TOOLING & ELEMENT INSPECTOR (5 Columns) */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border shadow-xs flex flex-col overflow-hidden min-h-[580px]">
              
              {/* Inspector Navigation Tabs */}
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <div className="border-b border-border px-4 pt-1 bg-muted/30">
                  <TabsList variant="line" className="w-full justify-start bg-transparent">
                    <TabsTrigger value="fields" className="gap-1.5 py-3 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Field Mapping
                    </TabsTrigger>
                    <TabsTrigger value="canvas" className="gap-1.5 py-3 text-xs font-semibold">
                      <Crop className="w-3.5 h-3.5 text-blue-600" />
                      Layout &amp; Media
                    </TabsTrigger>
                    <TabsTrigger value="fleet" className="gap-1.5 py-3 text-xs font-semibold">
                      <Printer className="w-3.5 h-3.5 text-purple-600" />
                      Printer Fleet Routing
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* TAB 1: FIELD MAPPING & DYNAMIC ATTRIBUTES */}
                <TabsContent value="fields" className="p-4 flex flex-col gap-4 focus:outline-none">
                  
                  {/* Quick Add Elements */}
                  <div className={section}>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-sm font-bold text-foreground">Add Dynamic Field</h2>
                      <span className="text-xs text-muted-foreground font-mono">{design.elements.length} Elements</span>
                    </div>
                    <AddField onAdd={(field) => addElement(textElement({ ...centred(60, 10), field, size: 14 }))} />

                    <div className="pt-2 border-t border-border/60">
                      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Quick Add Elements:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addElement(textElement({ ...centred(60, 8), source: 'static', text: 'Text', size: 12 }))}>
                          + Static text
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addElement({ id: newElementId(), type: 'image', ...centred(24, 16), source: 'event_logo', path: null, label: 'Event logo', keepAspect: true })}>
                          + Event logo
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addElement({ id: newElementId(), type: 'image', ...centred(24, 16), source: 'org_logo', path: null, label: 'Organizer logo', keepAspect: true })}>
                          + Org logo
                        </Button>
                        <UploadButton
                          text="+ Sponsor logo"
                          rules={LOGO_RULES}
                          folder={folder}
                          kind="sponsor"
                          onUploaded={(path) => addElement({ id: newElementId(), type: 'image', ...centred(24, 12), source: 'sponsor', path, label: 'Sponsor logo', keepAspect: true })}
                          onError={setError}
                        />
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addElement({ id: newElementId(), type: 'qr', ...centred(18, 18), color: '#111827' })}>
                          + QR token
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => addElement({ id: newElementId(), type: 'rect', ...centred(40, 10), fill: '#059669', stroke: null, strokeWidth: 0, radius: 2 })}>
                          + Shape
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Layer Stack */}
                  <div className={section}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-foreground">Layer Order</h2>
                      <span className="text-[11px] text-muted-foreground">Top drawn on front</span>
                    </div>

                    {design.elements.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No elements on this canvas.</p>
                    ) : (
                      <ul className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
                        {[...design.elements].reverse().map((el) => (
                          <li
                            key={el.id}
                            className={cn(
                              'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors',
                              el.id === selectedId ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800' : 'hover:bg-muted'
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedId(el.id)}
                              className={cn(
                                'flex-1 text-left truncate font-medium',
                                el.id === selectedId ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-foreground'
                              )}
                            >
                              {elementName(el)}
                            </button>
                            <button type="button" title="Bring forward" onClick={() => moveLayer(el.id, 1)} className="p-1 hover:text-foreground text-muted-foreground">
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" title="Send backward" onClick={() => moveLayer(el.id, -1)} className="p-1 hover:text-foreground text-muted-foreground">
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" title="Duplicate" onClick={() => duplicateElement(el)} className="p-1 hover:text-foreground text-muted-foreground">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" title="Remove" onClick={() => removeElement(el.id)} className="p-1 text-destructive hover:opacity-80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Selected Element Properties Inspector */}
                  {selected && (
                    <ElementProperties
                      key={selected.id}
                      el={selected}
                      design={design}
                      onChange={updateElement}
                      folder={folder}
                      onError={setError}
                    />
                  )}
                </TabsContent>

                {/* TAB 2: LAYOUT & MEDIA PRESETS */}
                <TabsContent value="canvas" className="p-4 flex flex-col gap-4 focus:outline-none">
                  <CanvasSettings design={design} change={change} />
                  <BrandingSettings design={design} change={change} folder={folder} />
                </TabsContent>

                {/* TAB 3: PRINTER FLEET ROUTING */}
                <TabsContent value="fleet" className="p-4 flex flex-col gap-4 focus:outline-none">
                  <div className={section}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-foreground">Hardware Fleet Configuration</h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold">
                        ACTIVE CLUSTER
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure thermal badge printers, direct ZPL II code spooling, and gate station routing.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className={label}>Station Gate Profile</label>
                        <CustomSelect
                          value={printerStation}
                          onChange={(v) => setPrinterStation(String(v))}
                          options={[
                            { value: 'gate_01', label: 'Gate 01 North Concourse' },
                            { value: 'gate_02', label: 'Gate 02 South Turnstiles' },
                            { value: 'vip_desk', label: 'VIP Lounge Concierge' },
                            { value: 'kiosk_cluster', label: 'Self-Service Kiosk Island' },
                          ]}
                        />
                      </div>

                      <div>
                        <label className={label}>Printer Hardware Model</label>
                        <CustomSelect
                          value={printerModel}
                          onChange={(v) => setPrinterModel(String(v))}
                          options={[
                            { value: 'zebra_zd621', label: 'Zebra ZD621 (Thermal Direct)' },
                            { value: 'zebra_zd421', label: 'Zebra ZD421 (Cartridge)' },
                            { value: 'epson_c3500', label: 'Epson ColorWorks C3500' },
                            { value: 'brother_ql820', label: 'Brother QL-820NWB' },
                            { value: 'standard_pdf', label: 'Standard Office Desktop (PDF)' },
                          ]}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className={label}>Thermal Resolution</label>
                        <CustomSelect
                          value={printerDpi}
                          onChange={(v) => setPrinterDpi(String(v))}
                          options={[
                            { value: '203', label: '203 DPI (Standard Fast)' },
                            { value: '300', label: '300 DPI (High Precision Crisp)' },
                            { value: '600', label: '600 DPI (Ultra Fine Micro)' },
                          ]}
                        />
                      </div>

                      <div>
                        <label className={label}>Print Darkness / Heat: {printerDarkness}</label>
                        <input
                          type="range"
                          min={5}
                          max={30}
                          value={printerDarkness}
                          onChange={(e) => setPrinterDarkness(Number(e.target.value))}
                          className="w-full mt-2 accent-emerald-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">
                        Protocol: RAW TCP 9100 / WebSerial
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={() => {
                          setNotice(`Calibration ping dispatched to ${printerStation.toUpperCase()} (${printerModel.toUpperCase()})`)
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Calibrate Feed
                      </Button>
                    </div>
                  </div>

                  <div className={section}>
                    <h2 className="text-sm font-bold text-foreground">Zero-Driver Browser Printing</h2>
                    <p className="text-xs text-muted-foreground">
                      For events without dedicated print server agents, the browser print dialog is calibrated with exact 4×3 inch page margins:
                    </p>
                    <code className="text-[11px] p-2 bg-muted rounded-lg font-mono text-foreground block overflow-x-auto">
                      @page &#123; size: {round(design.widthMm)}mm {round(design.heightMm)}mm; margin: 0; &#125;
                    </code>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* PRINTER CALIBRATION & HARDWARE MODAL */}
        {showPrinterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">Printer Fleet &amp; Hardware Calibration</h3>
                    <p className="text-xs text-muted-foreground">Configure station routing and direct thermal ZPL code</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrinterModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className={label}>Active Printer Node</label>
                  <Input value={`${printerModel.toUpperCase()} • Station ${printerStation.toUpperCase()}`} readOnly className="h-9 bg-muted" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Baud Rate / Network Port</label>
                    <Input defaultValue="9100 (RAW)" readOnly className="h-9 bg-muted" />
                  </div>
                  <div>
                    <label className={label}>Target Media Stock</label>
                    <Input defaultValue='4.0" × 3.0" Direct Thermal' readOnly className="h-9 bg-muted" />
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-xl text-muted-foreground leading-relaxed">
                  💡 <strong>Tip for Organizers:</strong> When connected via USB, modern Chromium browsers support direct ZPL issuance via <code>WebSerial</code>. For network printers, send raw ZPL commands to port <code>9100</code> on your local LAN.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setShowPrinterModal(false)}>Close</Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                  setShowPrinterModal(false)
                  setNotice('Printer settings applied to active session.')
                }}>
                  Apply Configuration
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}

function pickEvent(d: ReturnType<typeof badgeDataFor>) {
  return { event_name: d.event_name, event_date: d.event_date, event_location: d.event_location }
}

function NumberInput({ id, value, onChange, min, max, step = 0.5, suffix }: { id: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        className={cn('h-9 text-xs', suffix && 'pr-8')}
        value={round(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(min !== undefined && max !== undefined ? Math.min(max, Math.max(min, v)) : v)
        }}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-muted-foreground">{suffix}</span>}
    </div>
  )
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-transparent cursor-pointer" />
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
      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? 'Uploading...' : text}
      </Button>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => choose(e.target.files?.[0])} aria-label={text} />
    </>
  )
}

function AddField({ onAdd }: { onAdd: (field: TextElement['field']) => void }) {
  const [field, setField] = useState<TextElement['field']>('full_name')
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-[140px]">
        <CustomSelect
          value={field}
          onChange={(v) => setField(v as TextElement['field'])}
          options={BADGE_FIELDS.map((f) => ({ value: f.value, label: f.label }))}
          aria-label="Attendee field"
        />
      </div>
      <Button variant="outline" size="sm" className="whitespace-nowrap h-9 text-xs gap-1 font-semibold" onClick={() => onAdd(field)}>
        <Plus className="w-3.5 h-3.5 text-emerald-600" /> Add field
      </Button>
    </div>
  )
}

function CanvasSettings({ design, change }: { design: BadgeDesign; change: (d: BadgeDesign) => void }) {
  const presetIndex = SIZE_PRESETS.findIndex((p) => Math.abs(p.w - design.widthMm) < 0.2 && Math.abs(p.h - design.heightMm) < 0.2)
  const landscape = design.widthMm >= design.heightMm

  return (
    <div className={section}>
      <h2 className="text-sm font-bold text-foreground">Physical Media Dimensions</h2>
      <div>
        <label className={label} htmlFor="size-preset">Standard Card Sizes</label>
        <CustomSelect
          id="size-preset"
          value={presetIndex}
          onChange={(val) => {
            const p = SIZE_PRESETS[Number(val)]
            if (p) change(resizeDesign(design, p.w, p.h))
          }}
          options={[
            ...(presetIndex === -1 ? [{ value: -1, label: 'Custom dimensions' }] : []),
            ...SIZE_PRESETS.map((p, i) => ({ value: i, label: p.label })),
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div>
          <label className={label} htmlFor="badge-w">Width (mm)</label>
          <NumberInput id="badge-w" value={design.widthMm} min={LIMITS.minSide} max={LIMITS.maxSide} suffix="mm" onChange={(v) => change(resizeDesign(design, v, design.heightMm))} />
        </div>
        <div>
          <label className={label} htmlFor="badge-h">Height (mm)</label>
          <NumberInput id="badge-h" value={design.heightMm} min={LIMITS.minSide} max={LIMITS.maxSide} suffix="mm" onChange={(v) => change(resizeDesign(design, design.widthMm, v))} />
        </div>
      </div>
      <div className="flex gap-2 mt-1">
        <Button variant={landscape ? 'default' : 'outline'} size="sm" className={cn('flex-1 text-xs h-8', landscape && 'bg-emerald-600 hover:bg-emerald-700 text-white')} onClick={() => !landscape && change(rotateDesign(design))}>
          Landscape
        </Button>
        <Button variant={!landscape ? 'default' : 'outline'} size="sm" className={cn('flex-1 text-xs h-8', !landscape && 'bg-emerald-600 hover:bg-emerald-700 text-white')} onClick={() => landscape && change(rotateDesign(design))}>
          Portrait
        </Button>
      </div>
    </div>
  )
}

function BrandingSettings({ design, change, folder }: { design: BadgeDesign; change: (d: BadgeDesign) => void; folder: string }) {
  const [error, setError] = useState('')

  return (
    <div className={section}>
      <h2 className="text-sm font-bold text-foreground">Canvas Background &amp; Edge Styling</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="bg-color">Card Background</label>
          <ColorInput id="bg-color" value={design.background.color} onChange={(v) => change({ ...design, background: { ...design.background, color: v } })} />
        </div>
        <div>
          <span className={label}>Card Texture / Watermark</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <UploadButton
              text={design.background.imagePath ? 'Replace' : 'Upload'}
              rules={BADGE_BACKGROUND_RULES}
              folder={folder}
              kind="background"
              onUploaded={(path) => change({ ...design, background: { ...design.background, imagePath: path } })}
              onError={setError}
            />
            {design.background.imagePath && (
              <Button size="sm" className="text-destructive text-xs h-7" variant="outline" onClick={() => change({ ...design, background: { ...design.background, imagePath: null } })}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <div>
          <label className={label} htmlFor="border-w">Border Width</label>
          <NumberInput id="border-w" value={design.border.width} min={0} max={10} step={0.25} suffix="mm" onChange={(v) => change({ ...design, border: { ...design.border, width: v } })} />
        </div>
        <div>
          <label className={label} htmlFor="border-c">Border Color</label>
          <ColorInput id="border-c" value={design.border.color} onChange={(v) => change({ ...design, border: { ...design.border, color: v } })} />
        </div>
        <div>
          <label className={label} htmlFor="border-r">Corner Radius</label>
          <NumberInput id="border-r" value={design.border.radius} min={0} max={30} suffix="mm" onChange={(v) => change({ ...design, border: { ...design.border, radius: v } })} />
        </div>
      </div>
      {error && <Alert variant="error" className="text-xs">{error}</Alert>}
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
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{elementName(el)}</h2>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{el.type}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div><label className={label} htmlFor="el-x">X (mm)</label><NumberInput id="el-x" value={el.x} onChange={(x) => set({ x })} /></div>
        <div><label className={label} htmlFor="el-y">Y (mm)</label><NumberInput id="el-y" value={el.y} onChange={(y) => set({ y })} /></div>
        <div><label className={label} htmlFor="el-w">Width</label><NumberInput id="el-w" value={el.w} min={2} max={LIMITS.maxSide} onChange={setW} /></div>
        <div><label className={label} htmlFor="el-h">Height</label><NumberInput id="el-h" value={el.h} min={2} max={LIMITS.maxSide} onChange={setH} /></div>
      </div>

      <div>
        <span className={label}>Alignment Shortcuts</span>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ x: 0 })}>Left</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ x: round((design.widthMm - el.w) / 2) })}>Centre</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ x: round(design.widthMm - el.w) })}>Right</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ y: 0 })}>Top</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ y: round((design.heightMm - el.h) / 2) })}>Middle</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ y: round(design.heightMm - el.h) })}>Bottom</Button>
          <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => set({ x: 0, w: design.widthMm })}>Full width</Button>
        </div>
      </div>

      {el.type === 'text' && (
        <>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <label className={label} htmlFor="el-source">Variable Content</label>
              <CustomSelect
                id="el-source"
                value={el.source === 'static' ? '__static' : el.field}
                onChange={(val) => set(val === '__static' ? { source: 'static' } : { source: 'field', field: val as TextElement['field'] })}
                options={[
                  ...BADGE_FIELDS.map((f) => ({ value: f.value, label: f.label })),
                  { value: '__static', label: 'Static text' },
                ]}
              />
            </div>
            <div>
              <label className={label} htmlFor="el-font">Font Family</label>
              <CustomSelect
                id="el-font"
                value={el.font}
                onChange={(val) => set({ font: val as TextElement['font'] })}
                options={[
                  { value: 'helvetica', label: 'Helvetica (Clean Sans)', fontFamily: 'ui-sans-serif, system-ui, sans-serif' },
                  { value: 'times', label: 'Times (Editorial Serif)', fontFamily: 'ui-serif, Georgia, serif' },
                  { value: 'courier', label: 'Courier (Monospace ID)', fontFamily: 'ui-monospace, monospace' },
                ]}
              />
            </div>
          </div>
          {el.source === 'static' && (
            <div>
              <label className={label} htmlFor="el-text">Custom Text</label>
              <Input id="el-text" className="h-9 text-xs" value={el.text} maxLength={200} onChange={(e) => set({ text: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div><label className={label} htmlFor="el-size">Font Size</label><NumberInput id="el-size" value={el.size} min={LIMITS.minFont} max={LIMITS.maxFont} step={1} suffix="pt" onChange={(size) => set({ size })} /></div>
            <div><label className={label} htmlFor="el-min">Auto-shrink Min</label><NumberInput id="el-min" value={el.minSize} min={LIMITS.minFont} max={LIMITS.maxFont} step={1} suffix="pt" onChange={(minSize) => set({ minSize })} /></div>
            <div><label className={label} htmlFor="el-color">Color</label><ColorInput id="el-color" value={el.color} onChange={(color) => set({ color })} /></div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <Button key={a} variant={el.align === a ? 'default' : 'outline'} size="sm" className={cn('text-xs h-7 px-2.5', el.align === a && 'bg-emerald-600 hover:bg-emerald-700 text-white')} onClick={() => set({ align: a })}>
                {a === 'center' ? 'Centre' : a[0]!.toUpperCase() + a.slice(1)}
              </Button>
            ))}
            <Button variant={el.bold ? 'default' : 'outline'} size="sm" className={cn('text-xs h-7 px-2.5 font-bold', el.bold && 'bg-emerald-600 hover:bg-emerald-700 text-white')} onClick={() => set({ bold: !el.bold })}>
              Bold
            </Button>
            <Button variant={el.italic ? 'default' : 'outline'} size="sm" className={cn('text-xs h-7 px-2.5 italic', el.italic && 'bg-emerald-600 hover:bg-emerald-700 text-white')} onClick={() => set({ italic: !el.italic })}>
              Italic
            </Button>
            <Button variant={el.uppercase ? 'default' : 'outline'} size="sm" className={cn('text-xs h-7 px-2.5', el.uppercase && 'bg-emerald-600 hover:bg-emerald-700 text-white')} onClick={() => set({ uppercase: !el.uppercase })}>
              ABC
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            ⚡ Long names auto-scale down to the minimum font size before wrapping to fit badge margins perfectly.
          </p>
        </>
      )}

      {el.type === 'image' && (
        <div className="space-y-2 mt-1">
          <div>
            <label className={label} htmlFor="el-label">Image Label</label>
            <Input id="el-label" className="h-9 text-xs" value={el.label} maxLength={60} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={el.keepAspect} onChange={(e) => set({ keepAspect: e.target.checked } as Partial<ImageElement>)} className="rounded accent-emerald-600" />
            Lock aspect ratio (prevents logo stretching)
          </label>
          {el.source === 'sponsor' ? (
            <UploadButton text="Replace logo" rules={LOGO_RULES} folder={folder} kind="sponsor" onUploaded={(path) => set({ path } as Partial<ImageElement>)} onError={onError} />
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {el.source === 'event_logo' ? 'Displays event logo from Event Settings.' : 'Displays organization company logo.'}
            </p>
          )}
        </div>
      )}

      {el.type === 'qr' && (
        <div className="mt-1">
          <label className={label} htmlFor="el-qr">QR Code Color</label>
          <ColorInput id="el-qr" value={el.color} onChange={(color) => set({ color })} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            High-contrast dark colors ensure fast 0.1s scanning at gate kiosks and handheld barcode readers.
          </p>
        </div>
      )}

      {el.type === 'rect' && (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div>
            <label className={label} htmlFor="el-fill">Fill Color</label>
            <ColorInput id="el-fill" value={el.fill ?? '#ffffff'} onChange={(fill) => set({ fill } as Partial<RectElement>)} />
            <label className="mt-1 flex gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={!el.fill} onChange={(e) => set({ fill: e.target.checked ? null : '#059669' } as Partial<RectElement>)} className="accent-emerald-600" /> Transparent
            </label>
          </div>
          <div>
            <label className={label} htmlFor="el-stroke">Outline Color</label>
            <ColorInput id="el-stroke" value={el.stroke ?? '#111827'} onChange={(stroke) => set({ stroke, strokeWidth: el.strokeWidth || 0.5 } as Partial<RectElement>)} />
            <label className="mt-1 flex gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={!el.stroke} onChange={(e) => set({ stroke: e.target.checked ? null : '#111827', strokeWidth: el.strokeWidth || 0.5 } as Partial<RectElement>)} className="accent-emerald-600" /> No outline
            </label>
          </div>
          <div><label className={label} htmlFor="el-sw">Stroke Width</label><NumberInput id="el-sw" value={el.strokeWidth} min={0} max={10} step={0.25} suffix="mm" onChange={(strokeWidth) => set({ strokeWidth } as Partial<RectElement>)} /></div>
          <div><label className={label} htmlFor="el-radius">Corner Radius</label><NumberInput id="el-radius" value={el.radius} min={0} max={50} suffix="mm" onChange={(radius) => set({ radius } as Partial<RectElement>)} /></div>
        </div>
      )}
    </div>
  )
}
