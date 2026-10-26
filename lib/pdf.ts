// Attendance report PDFs (Step 6), using pdf-lib. Badges are rendered by lib/badgePdf.ts.
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib'

// Standard fonts only cover Latin (WinAnsi) characters; replace anything else
function safeText(font: PDFFont, text: string): string {
  return [...text]
    .map((ch) => {
      try {
        font.encodeText(ch)
        return ch
      } catch {
        return '?'
      }
    })
    .join('')
}

// Shrinks the font size down to `minSize`, then truncates with "…" to fit `maxWidth`
function fitText(font: PDFFont, text: string, size: number, minSize: number, maxWidth: number) {
  let t = safeText(font, text)
  let s = size
  while (s > minSize && font.widthOfTextAtSize(t, s) > maxWidth) s -= 0.5
  if (font.widthOfTextAtSize(t, s) > maxWidth) {
    while (t.length > 1 && font.widthOfTextAtSize(t + '...', s) > maxWidth) t = t.slice(0, -1)
    t += '...'
  }
  return { text: t, size: s }
}

export interface ReportSection {
  title: string
  headers: string[]
  rows: string[][]
  // Relative column widths (same length as headers)
  widths: number[]
}

// Landscape A4 report: title, summary lines, then one table per section
export async function buildReportPdf(title: string, subtitle: string, summary: [string, string][], sections: ReportSection[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const W = 842
  const H = 595
  const M = 36
  const text = rgb(0.07, 0.09, 0.15)
  const muted = rgb(0.42, 0.45, 0.5)
  const line = rgb(0.82, 0.84, 0.86)

  let page = doc.addPage([W, H])
  let y = H - M

  const newPage = () => {
    page = doc.addPage([W, H])
    y = H - M
  }
  const ensure = (needed: number) => {
    if (y - needed < M) newPage()
  }
  const write = (t: string, size: number, font = regular, color = text, x = M) => {
    page.drawText(fitText(font, t, size, size, W - M - x).text, { x, y, size, font, color })
  }

  write(title, 18, bold)
  y -= 20
  write(subtitle, 10, regular, muted)
  y -= 24

  for (const [label, value] of summary) {
    write(label, 11, regular, muted)
    write(value, 11, bold, text, M + 160)
    y -= 16
  }
  y -= 12

  for (const section of sections) {
    const total = section.widths.reduce((a, b) => a + b, 0)
    const colWidths = section.widths.map((w) => ((W - 2 * M) * w) / total)
    const drawHeader = () => {
      let x = M
      section.headers.forEach((h, i) => {
        page.drawText(fitText(bold, h, 8, 8, colWidths[i]! - 6).text, { x, y, size: 8, font: bold, color: muted })
        x += colWidths[i]!
      })
      y -= 6
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: line })
      y -= 12
    }

    ensure(60)
    write(`${section.title} (${section.rows.length})`, 13, bold)
    y -= 20
    if (section.rows.length === 0) {
      write('None', 9, regular, muted)
      y -= 24
      continue
    }
    drawHeader()
    for (const row of section.rows) {
      if (y < M + 12) {
        newPage()
        write(`${section.title} (continued)`, 11, bold)
        y -= 18
        drawHeader()
      }
      let x = M
      row.forEach((cell, i) => {
        page.drawText(fitText(regular, cell, 8, 8, colWidths[i]! - 6).text, { x, y, size: 8, font: regular, color: text })
        x += colWidths[i]!
      })
      y -= 13
    }
    y -= 18
  }

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 60, y: 18, size: 8, font: regular, color: muted })
  })
  return doc.save()
}
