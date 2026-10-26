'use client'

import { useMemo, useRef } from 'react'
import QRCode from 'qrcode'
import {
  BadgeData, BadgeDesign, BadgeElement, BadgeImages, FontFamily, LINE_HEIGHT, MM_TO_PT, TextElement, elementText, imagePathFor, layoutText,
} from '@/lib/badgeDesign'
import { publicImageUrl } from '@/lib/images'

const CSS_FONTS: Record<FontFamily, string> = {
  helvetica: 'Helvetica, Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
}

let measureCtx: CanvasRenderingContext2D | null = null
// Text width in points for a font size in points (canvas px used as pt units)
function measure(el: TextElement, text: string, size: number): number {
  if (typeof document === 'undefined') return text.length * size * 0.55
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * size * 0.55
  measureCtx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${size}px ${CSS_FONTS[el.font]}`
  return measureCtx.measureText(text).width
}

interface Props {
  design: BadgeDesign
  data: BadgeData
  images: BadgeImages
  // Pixels per millimetre
  scale: number
  editable?: boolean
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onElementChange?: (el: BadgeElement) => void
}

const SNAP = 0.5
const snap = (v: number) => Math.round(v / SNAP) * SNAP

export default function BadgePreview({ design, data, images, scale, editable, selectedId, onSelect, onElementChange }: Props) {
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: BadgeElement } | null>(null)
  const ptToPx = (pt: number) => (pt / MM_TO_PT) * scale

  const startDrag = (e: React.PointerEvent, el: BadgeElement, mode: 'move' | 'resize') => {
    if (!editable) return
    e.stopPropagation()
    e.preventDefault()
    onSelect?.(el.id)
    dragRef.current = { id: el.id, mode, startX: e.clientX, startY: e.clientY, orig: el }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !onElementChange) return
    const dx = (e.clientX - drag.startX) / scale
    const dy = (e.clientY - drag.startY) / scale
    const o = drag.orig
    if (drag.mode === 'move') {
      onElementChange({ ...o, x: snap(o.x + dx), y: snap(o.y + dy) })
    } else {
      let w = Math.max(2, snap(o.w + dx))
      let h = Math.max(2, snap(o.h + dy))
      // Locked images keep their box proportions
      if (o.type === 'image' && o.keepAspect) h = Math.max(2, snap((w * o.h) / o.w))
      if (o.type === 'qr') w = h = Math.max(w, h)
      onElementChange({ ...o, w, h })
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const bgUrl = publicImageUrl('branding', design.background.imagePath)

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={() => editable && onSelect?.(null)}
      style={{
        position: 'relative',
        width: design.widthMm * scale,
        height: design.heightMm * scale,
        backgroundColor: design.background.color,
        backgroundImage: bgUrl ? `url("${bgUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        borderRadius: design.border.radius * scale,
        touchAction: editable ? 'none' : undefined,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {design.elements.map((el) => (
        <div
          key={el.id}
          onPointerDown={(e) => startDrag(e, el, 'move')}
          style={{
            position: 'absolute',
            left: el.x * scale,
            top: el.y * scale,
            width: el.w * scale,
            height: el.h * scale,
            cursor: editable ? 'move' : undefined,
            outline: editable && selectedId === el.id ? '2px solid #3b82f6' : editable ? '1px dashed rgba(59,130,246,0.35)' : undefined,
            outlineOffset: 0,
          }}
        >
          <ElementView el={el} data={data} images={images} scale={scale} ptToPx={ptToPx} />
          {editable && selectedId === el.id && (
            <div
              onPointerDown={(e) => startDrag(e, el, 'resize')}
              aria-label="Resize"
              style={{
                position: 'absolute', right: -6, bottom: -6, width: 12, height: 12, backgroundColor: '#3b82f6',
                border: '2px solid #ffffff', borderRadius: 2, cursor: 'nwse-resize',
              }}
            />
          )}
        </div>
      ))}
      {design.border.width > 0 && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            border: `${design.border.width * scale}px solid ${design.border.color}`, borderRadius: design.border.radius * scale,
          }}
        />
      )}
    </div>
  )
}

function ElementView({ el, data, images, scale, ptToPx }: { el: BadgeElement; data: BadgeData; images: BadgeImages; scale: number; ptToPx: (pt: number) => number }) {
  const qr = useMemo(() => (el.type === 'qr' && data.registration_id ? QRCode.create(data.registration_id, { errorCorrectionLevel: 'M' }).modules : null), [el.type, data.registration_id])

  if (el.type === 'rect') {
    return (
      <div
        style={{
          width: '100%', height: '100%', backgroundColor: el.fill ?? 'transparent', borderRadius: el.radius * scale,
          border: el.stroke ? `${el.strokeWidth * scale}px solid ${el.stroke}` : undefined, boxSizing: 'border-box',
        }}
      />
    )
  }

  if (el.type === 'image') {
    const url = publicImageUrl('branding', imagePathFor(el, images))
    if (!url) {
      return (
        <div style={{ width: '100%', height: '100%', border: '1px dashed #9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(8, scale * 2.5), color: '#6b7280', textAlign: 'center', overflow: 'hidden' }}>
          {el.label || 'Logo'}
        </div>
      )
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={el.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: el.keepAspect ? 'contain' : 'fill', pointerEvents: 'none' }} />
  }

  if (el.type === 'qr') {
    if (!qr) return null
    return (
      <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" style={{ display: 'block' }}>
        <rect width={qr.size} height={qr.size} fill="#ffffff" />
        {Array.from({ length: qr.size * qr.size }, (_, i) => {
          const r = Math.floor(i / qr.size)
          const c = i % qr.size
          return qr.get(r, c) ? <rect key={i} x={c} y={r} width={1.02} height={1.02} fill={el.color} /> : null
        })}
      </svg>
    )
  }

  const text = elementText(el, data)
  const { lines, size } = layoutText(text, el.w * MM_TO_PT, el.h * MM_TO_PT, el.size, el.minSize, (t, s) => measure(el, t, s))
  const lineH = ptToPx(size * LINE_HEIGHT)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', pointerEvents: 'none' }}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            height: lineH, lineHeight: `${lineH}px`, fontSize: ptToPx(size), fontFamily: CSS_FONTS[el.font],
            fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : 'normal', color: el.color,
            textAlign: el.align, whiteSpace: 'pre', overflow: 'hidden',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}
