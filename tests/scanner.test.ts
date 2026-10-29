import jsQR from 'jsqr'
import QRCode from 'qrcode'

// Renders a QR code to RGBA pixels the way a camera frame looks to the decoder
function renderQr(text: string, moduleSize = 6, quiet = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const side = (n + quiet * 2) * moduleSize
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y)) continue
      for (let dy = 0; dy < moduleSize; dy++) {
        for (let dx = 0; dx < moduleSize; dx++) {
          const px = (x + quiet) * moduleSize + dx
          const py = (y + quiet) * moduleSize + dy
          const i = (py * side + px) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return { data, side }
}

describe('QR fallback decoder (iPhone Safari has no BarcodeDetector)', () => {
  it('reads a badge link', () => {
    const link = 'https://eventcheckin-five.vercel.app/badge/a1b2c3d4e5f60718293a4b5c6d7e8f90'
    const { data, side } = renderQr(link)
    expect(jsQR(data, side, side)?.data).toBe(link)
  })

  it('reads a short registration ID', () => {
    const { data, side } = renderQr('AIMPF7')
    expect(jsQR(data, side, side)?.data).toBe('AIMPF7')
  })

  it('returns nothing for a blank frame', () => {
    const blank = new Uint8ClampedArray(200 * 200 * 4).fill(255)
    expect(jsQR(blank, 200, 200)).toBeNull()
  })
})
