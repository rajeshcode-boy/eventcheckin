// High-resolution check-in QR code downloads, generated in the browser.
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const PNG_WIDTH = 2048 // pixels; prints sharply at poster size

async function pngDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, { width: PNG_WIDTH, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#FFFFFF' } })
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function download(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

export async function downloadQrPng(value: string, filename: string) {
  download(await pngDataUrl(value), `${filename}.png`)
}

// A4 page: event name, the QR code large, and the link underneath so it can be typed by hand
export async function downloadQrPdf(value: string, eventName: string, filename: string) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)

  const image = await pdf.embedPng(base64ToBytes(await pngDataUrl(value)))
  const size = 420

  const title = eventName.length > 60 ? `${eventName.slice(0, 57)}...` : eventName
  const titleWidth = bold.widthOfTextAtSize(title, 24)
  page.drawText(title, { x: (595 - titleWidth) / 2, y: 740, size: 24, font: bold, color: rgb(0.08, 0.15, 0.11) })
  const hint = 'Scan to check in'
  const hintWidth = regular.widthOfTextAtSize(hint, 14)
  page.drawText(hint, { x: (595 - hintWidth) / 2, y: 712, size: 14, font: regular, color: rgb(0.29, 0.42, 0.37) })

  page.drawImage(image, { x: (595 - size) / 2, y: 260, width: size, height: size })

  const linkWidth = regular.widthOfTextAtSize(value, 11)
  page.drawText(value, { x: (595 - linkWidth) / 2, y: 230, size: 11, font: regular, color: rgb(0.29, 0.42, 0.37) })

  const bytes = await pdf.save()
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }))
  download(url, `${filename}.pdf`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
