// Badge design model shared by the designer (HTML preview) and the PDF renderer.
// All positions and sizes are in millimetres from the badge's top-left corner;
// font sizes are in points. Element order is drawing order (last on top).

import { countryName } from './countries'
import { registrationStatusLabel } from './guests'

export const MM_TO_PT = 72 / 25.4

export type FontFamily = 'helvetica' | 'times' | 'courier'
export type TextAlign = 'left' | 'center' | 'right'

export const BADGE_FIELDS = [
  { value: 'full_name', label: 'Attendee name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'company', label: 'Company' },
  { value: 'designation', label: 'Job title' },
  { value: 'country', label: 'Country' },
  { value: 'city', label: 'City' },
  { value: 'industry', label: 'Industry' },
  { value: 'registration_type', label: 'Registration type' },
  { value: 'registration_id', label: 'Registration ID' },
  { value: 'event_name', label: 'Event name' },
  { value: 'event_date', label: 'Event date' },
  { value: 'event_location', label: 'Event location' },
] as const

export type BadgeField = (typeof BADGE_FIELDS)[number]['value']
export type BadgeData = Record<BadgeField, string>

export const SAMPLE_BADGE_DATA: BadgeData = {
  full_name: 'Priya Sharma',
  first_name: 'Priya',
  last_name: 'Sharma',
  company: 'Acme Technologies',
  designation: 'Head of Product',
  country: 'India',
  city: 'Bengaluru',
  industry: 'Technology',
  registration_type: 'Registered',
  registration_id: 'A7K9Q2',
  event_name: 'Tech Fest',
  event_date: '15 Nov 2026',
  event_location: 'Bengaluru, India',
}

interface ElementBase {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface TextElement extends ElementBase {
  type: 'text'
  source: 'field' | 'static'
  field: BadgeField
  text: string
  font: FontFamily
  size: number
  minSize: number
  bold: boolean
  italic: boolean
  align: TextAlign
  color: string
  uppercase: boolean
}

export type ImageSource = 'event_logo' | 'org_logo' | 'sponsor'

export interface ImageElement extends ElementBase {
  type: 'image'
  source: ImageSource
  // Storage path in the `branding` bucket (sponsor logos)
  path: string | null
  label: string
  // true: fit inside the box keeping proportions; false: stretch to the box
  keepAspect: boolean
}

export interface QrElement extends ElementBase {
  type: 'qr'
  color: string
}

export interface RectElement extends ElementBase {
  type: 'rect'
  fill: string | null
  stroke: string | null
  strokeWidth: number
  radius: number
}

export type BadgeElement = TextElement | ImageElement | QrElement | RectElement

export interface BadgeDesign {
  version: 1
  widthMm: number
  heightMm: number
  background: { color: string; imagePath: string | null }
  border: { width: number; color: string; radius: number }
  elements: BadgeElement[]
}

export const SIZE_PRESETS = [
  { label: '4 × 3 in (landscape)', w: 101.6, h: 76.2 },
  { label: '3 × 4 in (portrait)', w: 76.2, h: 101.6 },
  { label: '4 × 6 in (portrait)', w: 101.6, h: 152.4 },
  { label: 'CR80 card 85.6 × 54 mm', w: 85.6, h: 54 },
  { label: 'A6 105 × 148 mm', w: 105, h: 148 },
] as const

export const LIMITS = { minSide: 40, maxSide: 300, maxElements: 60, minFont: 4, maxFont: 120 }

let idCounter = 0
export function newElementId(): string {
  idCounter += 1
  return `el-${Date.now().toString(36)}-${idCounter}`
}

export function textElement(partial: Partial<TextElement> & Pick<TextElement, 'x' | 'y' | 'w' | 'h'>): TextElement {
  return {
    id: newElementId(), type: 'text', source: 'field', field: 'full_name', text: '', font: 'helvetica', size: 14, minSize: 8,
    bold: false, italic: false, align: 'center', color: '#111827', uppercase: false, ...partial,
  }
}

export function defaultDesign(): BadgeDesign {
  const W = 101.6
  return {
    version: 1,
    widthMm: W,
    heightMm: 76.2,
    background: { color: '#ffffff', imagePath: null },
    border: { width: 0, color: '#d1d5db', radius: 0 },
    elements: [
      { id: newElementId(), type: 'rect', x: 0, y: 0, w: W, h: 13, fill: '#10b981', stroke: null, strokeWidth: 0, radius: 0 },
      textElement({ x: 4, y: 1.5, w: W - 8, h: 10, field: 'event_name', size: 13, minSize: 8, bold: true, color: '#ffffff', uppercase: true }),
      textElement({ x: 4, y: 17, w: W - 8, h: 16, field: 'full_name', size: 26, minSize: 12, bold: true }),
      textElement({ x: 4, y: 34, w: W - 8, h: 7, field: 'designation', size: 13, minSize: 8, color: '#4b5563' }),
      textElement({ x: 4, y: 41, w: W - 8, h: 8, field: 'company', size: 15, minSize: 8, bold: true }),
      { id: newElementId(), type: 'image', x: 4, y: 55, w: 24, h: 17, source: 'event_logo', path: null, label: 'Event logo', keepAspect: true },
      textElement({ x: 30, y: 61, w: 44, h: 8, field: 'registration_id', size: 13, minSize: 9, font: 'courier', color: '#4b5563' }),
      { id: newElementId(), type: 'qr', x: W - 22, y: 54, w: 18, h: 18, color: '#111827' },
    ],
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v : fallback)
const optColor = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : null)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback)
const storagePath = (v: unknown) => (typeof v === 'string' && /^[\w-]+(\/[\w.-]+)+$/.test(v) && !v.includes('..') ? v : null)

// Validates a design loaded from the database (or anywhere else); bad values fall back to safe defaults
export function parseDesign(input: unknown): BadgeDesign {
  if (!input || typeof input !== 'object') return defaultDesign()
  const d = input as Record<string, unknown>
  const widthMm = num(d.widthMm, LIMITS.minSide, LIMITS.maxSide, 101.6)
  const heightMm = num(d.heightMm, LIMITS.minSide, LIMITS.maxSide, 76.2)
  const bg = (d.background ?? {}) as Record<string, unknown>
  const border = (d.border ?? {}) as Record<string, unknown>
  const fieldValues = BADGE_FIELDS.map((f) => f.value)

  const elements: BadgeElement[] = []
  for (const raw of Array.isArray(d.elements) ? d.elements.slice(0, LIMITS.maxElements) : []) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const base = {
      id: str(e.id, 40) || newElementId(),
      x: num(e.x, -widthMm, widthMm * 2, 0),
      y: num(e.y, -heightMm, heightMm * 2, 0),
      w: num(e.w, 1, LIMITS.maxSide, 20),
      h: num(e.h, 1, LIMITS.maxSide, 10),
    }
    if (e.type === 'text') {
      elements.push({
        ...base, type: 'text', source: oneOf(e.source, ['field', 'static'] as const, 'field'),
        field: oneOf(e.field, fieldValues, 'full_name'), text: str(e.text, 200),
        font: oneOf(e.font, ['helvetica', 'times', 'courier'] as const, 'helvetica'),
        size: num(e.size, LIMITS.minFont, LIMITS.maxFont, 14), minSize: num(e.minSize, LIMITS.minFont, LIMITS.maxFont, 8),
        bold: e.bold === true, italic: e.italic === true, align: oneOf(e.align, ['left', 'center', 'right'] as const, 'center'),
        color: color(e.color, '#111827'), uppercase: e.uppercase === true,
      })
    } else if (e.type === 'image') {
      elements.push({
        ...base, type: 'image', source: oneOf(e.source, ['event_logo', 'org_logo', 'sponsor'] as const, 'sponsor'),
        path: storagePath(e.path), label: str(e.label, 60), keepAspect: e.keepAspect !== false,
      })
    } else if (e.type === 'qr') {
      elements.push({ ...base, type: 'qr', color: color(e.color, '#111827') })
    } else if (e.type === 'rect') {
      elements.push({
        ...base, type: 'rect', fill: optColor(e.fill), stroke: optColor(e.stroke),
        strokeWidth: num(e.strokeWidth, 0, 10, 0), radius: num(e.radius, 0, 50, 0),
      })
    }
  }

  return {
    version: 1,
    widthMm,
    heightMm,
    background: { color: color(bg.color, '#ffffff'), imagePath: storagePath(bg.imagePath) },
    border: { width: num(border.width, 0, 10, 0), color: color(border.color, '#d1d5db'), radius: num(border.radius, 0, 30, 0) },
    elements,
  }
}

// Text an element shows for one attendee
export function elementText(el: TextElement, data: BadgeData): string {
  const value = el.source === 'static' ? el.text : data[el.field] ?? ''
  return el.uppercase ? value.toUpperCase() : value
}

// Swaps width and height and scales elements to the new shape
export function rotateDesign(design: BadgeDesign): BadgeDesign {
  const sx = design.heightMm / design.widthMm
  const sy = design.widthMm / design.heightMm
  return {
    ...design,
    widthMm: design.heightMm,
    heightMm: design.widthMm,
    elements: design.elements.map((e) => ({ ...e, x: e.x * sx, y: e.y * sy, w: e.w * sx, h: e.h * sy })),
  }
}

// Changes the badge size, scaling elements proportionally
export function resizeDesign(design: BadgeDesign, widthMm: number, heightMm: number): BadgeDesign {
  const sx = widthMm / design.widthMm
  const sy = heightMm / design.heightMm
  return {
    ...design,
    widthMm,
    heightMm,
    elements: design.elements.map((e) => ({ ...e, x: e.x * sx, y: e.y * sy, w: e.w * sx, h: e.h * sy })),
  }
}

export const LINE_HEIGHT = 1.15

export interface TextLayout {
  lines: string[]
  size: number
}

// Wraps words into lines no wider than maxWidth (long words are split)
export function wrapText(text: string, maxWidth: number, measure: (t: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (measure(word) <= maxWidth) {
      line = word
      continue
    }
    // Split a word that is wider than the box
    let part = ''
    for (const ch of word) {
      if (part && measure(part + ch) > maxWidth) {
        lines.push(part)
        part = ch
      } else {
        part += ch
      }
    }
    line = part
  }
  if (line) lines.push(line)
  return lines
}

// Largest size from `size` down to `minSize` at which the text fits the box
// (wrapping onto more lines if needed). At the minimum size, extra lines are
// cut and the last one ends with "...". Widths/heights are in points.
export function layoutText(
  text: string,
  boxWidth: number,
  boxHeight: number,
  size: number,
  minSize: number,
  measure: (t: string, size: number) => number
): TextLayout {
  if (!text.trim()) return { lines: [], size }
  const floor = Math.min(size, minSize)
  for (let s = size; s >= floor; s -= 0.5) {
    const lines = wrapText(text, boxWidth, (t) => measure(t, s))
    if (lines.length * s * LINE_HEIGHT <= boxHeight + 0.01) return { lines, size: s }
  }
  const s = floor
  const all = wrapText(text, boxWidth, (t) => measure(t, s))
  const maxLines = Math.max(1, Math.floor((boxHeight + 0.01) / (s * LINE_HEIGHT)))
  const lines = all.slice(0, maxLines)
  if (all.length > maxLines) {
    let last = lines[maxLines - 1] ?? ''
    while (last.length > 1 && measure(last + '...', s) > boxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '...'
  }
  return { lines, size: s }
}

export const PAPER_SIZES = {
  A4: { label: 'A4 (210 × 297 mm)', w: 210, h: 297 },
  Letter: { label: 'US Letter (8.5 × 11 in)', w: 215.9, h: 279.4 },
} as const
export type Paper = keyof typeof PAPER_SIZES

export const SHEET_MARGIN_MM = 10
export const SHEET_GAP_MM = 4

// How many badges fit on a sheet, and where each one goes (mm from page top-left).
// Uses whichever page orientation fits more badges.
export function sheetGrid(paper: Paper, badgeW: number, badgeH: number) {
  const { w, h } = PAPER_SIZES[paper]
  const portrait = gridOnPage(w, h, badgeW, badgeH)
  const landscape = gridOnPage(h, w, badgeW, badgeH)
  return landscape.perPage > portrait.perPage ? landscape : portrait
}

function gridOnPage(pageW: number, pageH: number, badgeW: number, badgeH: number) {
  const page = { w: pageW, h: pageH }
  const usableW = page.w - 2 * SHEET_MARGIN_MM
  const usableH = page.h - 2 * SHEET_MARGIN_MM
  const cols = Math.floor((usableW + SHEET_GAP_MM) / (badgeW + SHEET_GAP_MM))
  const rows = Math.floor((usableH + SHEET_GAP_MM) / (badgeH + SHEET_GAP_MM))
  // Centre the grid on the page
  const gridW = cols * badgeW + Math.max(0, cols - 1) * SHEET_GAP_MM
  const gridH = rows * badgeH + Math.max(0, rows - 1) * SHEET_GAP_MM
  const left = (page.w - gridW) / 2
  const top = (page.h - gridH) / 2
  const slots: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) slots.push({ x: left + c * (badgeW + SHEET_GAP_MM), y: top + r * (badgeH + SHEET_GAP_MM) })
  }
  return { page, cols, rows, perPage: cols * rows, slots }
}

// Rounded rectangle as an SVG path, origin at the top-left
export function roundedRectPath(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rr === 0) return `M0,0 H${w} V${h} H0 Z`
  return `M${rr},0 H${w - rr} A${rr},${rr} 0 0 1 ${w},${rr} V${h - rr} A${rr},${rr} 0 0 1 ${w - rr},${h} H${rr} A${rr},${rr} 0 0 1 0,${h - rr} V${rr} A${rr},${rr} 0 0 1 ${rr},0 Z`
}

// Badge values for one attendee of an event
export function badgeDataFor(
  attendee: {
    full_name: string; first_name?: string | null; last_name?: string | null; company?: string | null; designation?: string | null
    country?: string | null; city?: string | null; industry?: string | null; registration_status?: string | null; registration_id: string
  },
  event: { name: string; event_date: string; location: string; city?: string | null; country?: string | null }
): BadgeData {
  return {
    full_name: attendee.full_name,
    first_name: attendee.first_name ?? attendee.full_name.split(' ')[0] ?? '',
    last_name: attendee.last_name ?? '',
    company: attendee.company ?? '',
    designation: attendee.designation ?? '',
    country: countryName(attendee.country),
    city: attendee.city ?? '',
    industry: attendee.industry ?? '',
    registration_type: registrationStatusLabel(attendee.registration_status ?? 'registered'),
    registration_id: attendee.registration_id,
    event_name: event.name,
    event_date: new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    event_location: event.city && event.country ? `${event.city}, ${countryName(event.country)}` : event.location,
  }
}

export interface BadgeImages {
  eventLogoPath: string | null
  orgLogoPath: string | null
}

// Storage path an image element shows (event logo falls back to the organization logo)
export function imagePathFor(el: { source: string; path: string | null }, images: BadgeImages): string | null {
  if (el.source === 'event_logo') return images.eventLogoPath ?? images.orgLogoPath
  if (el.source === 'org_logo') return images.orgLogoPath
  return el.path
}
