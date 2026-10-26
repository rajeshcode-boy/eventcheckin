// Print-ready badge PDFs from a saved BadgeDesign (pdf-lib). Browser only:
// images are fetched from Storage and WebP is converted to PNG.
import {
  PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb,
} from 'pdf-lib'
import QRCode from 'qrcode'
import {
  BadgeData, BadgeDesign, BadgeImages, FontFamily, LINE_HEIGHT, MM_TO_PT, Paper, elementText, imagePathFor, layoutText, roundedRectPath, sheetGrid,
} from './badgeDesign'
import { detectImageType, publicImageUrl } from './images'

export interface PrintLayout {
  mode: 'single' | 'sheet'
  paper: Paper
  // Light outlines around each badge on sheets, to guide cutting
  guides: boolean
}

const STANDARD: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
}

// Bold and italic select the variant: [regular, bold, italic, bold italic]
const fontName = (family: FontFamily, bold: boolean, italic: boolean): StandardFonts =>
  STANDARD[family][(bold ? 1 : 0) + (italic ? 2 : 0)] ?? STANDARD[family][0]

const hexToRgb = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)

// Standard PDF fonts cover Latin (WinAnsi) only; other characters become "?"
function safeText(font: PDFFont, text: string): string {
  return [...text].map((ch) => {
    try {
      font.encodeText(ch)
      return ch
    } catch {
      return '?'
    }
  }).join('')
}

async function loadImageBytes(url: string): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    const type = detectImageType(bytes)
    if (type === 'image/png') return { bytes, kind: 'png' }
    if (type === 'image/jpeg') return { bytes, kind: 'jpg' }
    if (type === 'image/webp') {
      // pdf-lib can't embed WebP: redraw it as PNG
      const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }))
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
      bitmap.close()
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'png' } : null
    }
    return null
  } catch {
    return null
  }
}

export async function buildDesignBadgesPdf(
  title: string,
  design: BadgeDesign,
  badges: BadgeData[],
  images: BadgeImages,
  layout: PrintLayout
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)

  // Embed each distinct image once
  const embedded = new Map<string, PDFImage | null>()
  const paths = new Set<string>()
  for (const el of design.elements) {
    if (el.type === 'image') {
      const p = imagePathFor(el, images)
      if (p) paths.add(p)
    }
  }
  if (design.background.imagePath) paths.add(design.background.imagePath)
  await Promise.all(
    [...paths].map(async (p) => {
      const url = publicImageUrl('branding', p)
      const loaded = url ? await loadImageBytes(url) : null
      embedded.set(p, loaded ? (loaded.kind === 'png' ? await doc.embedPng(loaded.bytes) : await doc.embedJpg(loaded.bytes)) : null)
    })
  )

  const fonts = new Map<string, PDFFont>()
  const font = async (family: FontFamily, bold: boolean, italic: boolean) => {
    const name = fontName(family, bold, italic)
    if (!fonts.has(name)) fonts.set(name, await doc.embedFont(name))
    return fonts.get(name)!
  }
  // Pre-embed fonts used by the design
  for (const el of design.elements) if (el.type === 'text') await font(el.font, el.bold, el.italic)

  const W = design.widthMm * MM_TO_PT
  const H = design.heightMm * MM_TO_PT

  // Draws one badge with its top-left corner at (ox, oyTop) in page points (y measured from the page bottom)
  const drawBadge = (page: PDFPage, ox: number, oyTop: number, data: BadgeData) => {
    const toY = (mmTop: number, mmHeight: number) => oyTop - (mmTop + mmHeight) * MM_TO_PT

    // Keep everything inside the badge
    page.pushOperators(pushGraphicsState(), rectangle(ox, oyTop - H, W, H), clip(), endPath())

    page.drawRectangle({ x: ox, y: oyTop - H, width: W, height: H, color: hexToRgb(design.background.color) })
    const bg = design.background.imagePath ? embedded.get(design.background.imagePath) : null
    if (bg) {
      // Cover: fill the badge, cropping the overflow
      const scale = Math.max(W / bg.width, H / bg.height)
      const bw = bg.width * scale
      const bh = bg.height * scale
      page.drawImage(bg, { x: ox + (W - bw) / 2, y: oyTop - H + (H - bh) / 2, width: bw, height: bh })
    }

    for (const el of design.elements) {
      const x = ox + el.x * MM_TO_PT
      const w = el.w * MM_TO_PT
      const h = el.h * MM_TO_PT
      const y = toY(el.y, el.h)

      if (el.type === 'rect') {
        page.drawSvgPath(roundedRectPath(w, h, el.radius * MM_TO_PT), {
          x, y: y + h,
          color: el.fill ? hexToRgb(el.fill) : undefined,
          borderColor: el.stroke ? hexToRgb(el.stroke) : undefined,
          borderWidth: el.stroke ? el.strokeWidth * MM_TO_PT : 0,
        })
      } else if (el.type === 'image') {
        const path = imagePathFor(el, images)
        const img = path ? embedded.get(path) : null
        if (!img) continue
        if (el.keepAspect) {
          const scale = Math.min(w / img.width, h / img.height)
          const iw = img.width * scale
          const ih = img.height * scale
          page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih })
        } else {
          page.drawImage(img, { x, y, width: w, height: h })
        }
      } else if (el.type === 'qr') {
        const value = data.registration_id
        if (!value) continue
        const modules = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules
        const side = Math.min(w, h)
        const cell = side / modules.size
        const qx = x + (w - side) / 2
        const qyTop = y + (h + side) / 2
        page.drawRectangle({ x: qx, y: qyTop - side, width: side, height: side, color: rgb(1, 1, 1) })
        for (let r = 0; r < modules.size; r++) {
          for (let c = 0; c < modules.size; c++) {
            if (modules.get(r, c)) {
              // Slight overlap avoids hairline gaps between cells in some viewers
              page.drawRectangle({ x: qx + c * cell, y: qyTop - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: hexToRgb(el.color) })
            }
          }
        }
      } else if (el.type === 'text') {
        const f = fonts.get(fontName(el.font, el.bold, el.italic))!
        const text = safeText(f, elementText(el, data))
        const { lines, size } = layoutText(text, w, h, el.size, el.minSize, (t, s) => f.widthOfTextAtSize(t, s))
        const lineH = size * LINE_HEIGHT
        const blockTop = y + h - (h - lines.length * lineH) / 2
        lines.forEach((line, i) => {
          const tw = f.widthOfTextAtSize(line, size)
          const tx = el.align === 'left' ? x : el.align === 'right' ? x + w - tw : x + (w - tw) / 2
          // Baseline sits a little below the middle of the line box
          const baseline = blockTop - i * lineH - lineH / 2 - size * 0.35
          page.drawText(line, { x: tx, y: baseline, size, font: f, color: hexToRgb(el.color) })
        })
      }
    }

    if (design.border.width > 0) {
      const bw = design.border.width * MM_TO_PT
      page.drawSvgPath(roundedRectPath(W - bw, H - bw, design.border.radius * MM_TO_PT), {
        x: ox + bw / 2, y: oyTop - bw / 2, borderColor: hexToRgb(design.border.color), borderWidth: bw,
      })
    }

    page.pushOperators(popGraphicsState())
  }

  if (layout.mode === 'single') {
    for (const data of badges) {
      const page = doc.addPage([W, H])
      drawBadge(page, 0, H, data)
    }
  } else {
    const grid = sheetGrid(layout.paper, design.widthMm, design.heightMm)
    if (grid.perPage === 0) throw new Error('This badge is too large for the selected paper. Use "One badge per page".')
    const pageW = grid.page.w * MM_TO_PT
    const pageH = grid.page.h * MM_TO_PT
    for (let i = 0; i < badges.length; i += grid.perPage) {
      const page = doc.addPage([pageW, pageH])
      badges.slice(i, i + grid.perPage).forEach((data, j) => {
        const slot = grid.slots[j]!
        const ox = slot.x * MM_TO_PT
        const oyTop = pageH - slot.y * MM_TO_PT
        drawBadge(page, ox, oyTop, data)
        if (layout.guides) {
          page.drawRectangle({ x: ox, y: oyTop - H, width: W, height: H, borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4, borderDashArray: [3, 3] })
        }
      })
    }
  }

  return doc.save()
}
