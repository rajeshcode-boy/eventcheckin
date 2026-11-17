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
  showGrid?: boolean
  showGuides?: boolean
  backView?: boolean
  wifiConfig?: { ssid: string; passkey: string }
  onSelect?: (id: string | null) => void
  onElementChange?: (el: BadgeElement) => void
}

const SNAP = 0.5
const snap = (v: number) => Math.round(v / SNAP) * SNAP

export default function BadgePreview({
  design,
  data,
  images,
  scale,
  editable,
  selectedId,
  showGrid = false,
  showGuides = false,
  backView = false,
  wifiConfig = { ssid: 'VENUE-EVENT-GUEST', passkey: 'EventPass#2026' },
  onSelect,
  onElementChange,
}: Props) {
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
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
        borderRadius: Math.max(8, design.border.radius * scale),
        touchAction: editable ? 'none' : undefined,
        userSelect: 'none',
        flexShrink: 0,
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Lanyard punch-hole slot for realistic preview */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 8 * (scale / 4),
          left: '50%',
          transform: 'translateX(-50%)',
          width: 32 * (scale / 4),
          height: 8 * (scale / 4),
          borderRadius: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.2)',
          zIndex: 40,
          pointerEvents: 'none',
        }}
      />

      {/* Alignment Grid Overlay */}
      {showGrid && !backView && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 35,
            opacity: 0.35,
          }}
        >
          <defs>
            <pattern id="badge-grid" width={6.35 * scale} height={6.35 * scale} patternUnits="userSpaceOnUse">
              <path d={`M ${6.35 * scale} 0 L 0 0 0 ${6.35 * scale}`} fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="1 3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#badge-grid)" />
        </svg>
      )}

      {/* Safe Bleed Margins (0.125" / ~3.175mm) */}
      {showGuides && !backView && (
        <div
          style={{
            position: 'absolute',
            top: 3.175 * scale,
            left: 3.175 * scale,
            right: 3.175 * scale,
            bottom: 3.175 * scale,
            border: '1px dashed rgba(16, 185, 129, 0.65)',
            borderRadius: Math.max(4, (design.border.radius - 2) * scale),
            pointerEvents: 'none',
            zIndex: 36,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 6,
              fontSize: Math.max(8, scale * 1.8),
              fontFamily: 'monospace',
              color: '#059669',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            Safe Bleed 0.125&quot;
          </span>
        </div>
      )}

      {/* BACK VIEW OF BADGE (Emergency Wi-Fi, Agenda, Help Hotline) */}
      {backView ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: `${12 * (scale / 3.5)}px`,
            paddingTop: `${22 * (scale / 3.5)}px`,
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* Top: Wi-Fi Section */}
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: Math.max(10, scale * 2.8), fontWeight: 700, letterSpacing: '-0.01em' }}>
                Emergency &amp; Venue Wi-Fi
              </span>
              <span style={{ fontSize: Math.max(8, scale * 2), color: '#059669', fontWeight: 600 }}>● HIGH-SPEED</span>
            </div>
            <div style={{ backgroundColor: '#f1f5f9', borderRadius: 8, padding: '6px 10px', fontSize: Math.max(9, scale * 2.3) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#64748b' }}>SSID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{wifiConfig.ssid}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Passkey:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{wifiConfig.passkey}</span>
              </div>
            </div>
          </div>

          {/* Middle: Event Schedule Highlights */}
          <div style={{ margin: 'auto 0', padding: '6px 0' }}>
            <span style={{ fontSize: Math.max(8, scale * 2), textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>
              Scheduled Appearances &amp; Keynotes
            </span>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: Math.max(8, scale * 2.2) }}>
                <div style={{ fontWeight: 600 }}>Opening Keynote: Main Stage</div>
                <div style={{ color: '#64748b', fontSize: '90%' }}>Day 1 • 09:30 AM • Hall Alpha</div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: Math.max(8, scale * 2.2) }}>
                <div style={{ fontWeight: 600 }}>Networking &amp; VIP Reception</div>
                <div style={{ color: '#64748b', fontSize: '90%' }}>Day 1 • 05:30 PM • Skyline Lounge</div>
              </div>
            </div>
          </div>

          {/* Bottom: Concierge Hotline & Serial */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: Math.max(8, scale * 2) }}>
            <div>
              <div style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '80%', fontWeight: 700 }}>On-Site Concierge</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>+1 (800) 555-PASS</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '80%', fontWeight: 700 }}>Serial Verification</div>
              <div style={{ fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>#{data.registration_id || 'DEMO-001'}</div>
            </div>
          </div>
        </div>
      ) : (
        /* FRONT VIEW ELEMENTS */
        design.elements.map((el) => (
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
              outline: editable && selectedId === el.id ? '2px solid #059669' : editable ? '1px dashed rgba(5,150,105,0.35)' : undefined,
              outlineOffset: 0,
            }}
          >
            <ElementView el={el} data={data} images={images} scale={scale} ptToPx={ptToPx} />
            {editable && selectedId === el.id && (
              <div
                onPointerDown={(e) => startDrag(e, el, 'resize')}
                aria-label="Resize"
                style={{
                  position: 'absolute',
                  right: -6,
                  bottom: -6,
                  width: 12,
                  height: 12,
                  backgroundColor: '#059669',
                  border: '2px solid #ffffff',
                  borderRadius: 2,
                  cursor: 'nwse-resize',
                }}
              />
            )}
          </div>
        ))
      )}
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
