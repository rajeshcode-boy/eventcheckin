import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { parseBadgeCode } from '@/lib/badgeCode'
import { nativeQrDetector } from '@/lib/kiosk/scanner'

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

describe('parseBadgeCode', () => {
  it('reads the badge link from a pass QR code', () => {
    expect(parseBadgeCode(`https://eventcheckin-five.vercel.app/badge/${TOKEN}`)).toEqual({ kind: 'token', value: TOKEN })
  })

  it('reads a pass page link too', () => {
    expect(parseBadgeCode(`https://eventcheckin-five.vercel.app/pass/${TOKEN}?x=1`)).toEqual({ kind: 'token', value: TOKEN })
  })

  it('reads a bare token and a typed registration ID', () => {
    expect(parseBadgeCode(TOKEN)).toEqual({ kind: 'token', value: TOKEN })
    expect(parseBadgeCode(' xi8usp ')).toEqual({ kind: 'reg', value: 'XI8USP' })
  })

  it('flags QR codes that are not EventCheckin badges', () => {
    expect(parseBadgeCode('https://example.com/menu')).toEqual({ kind: 'unknown' })
    expect(parseBadgeCode('WIFI:S:venue;T:WPA;P:secret;;')).toEqual({ kind: 'unknown' })
    expect(parseBadgeCode('hello world')).toEqual({ kind: 'unknown' })
  })

  it('ignores an empty scan', () => {
    expect(parseBadgeCode('   ')).toBeNull()
  })
})

describe('nativeQrDetector', () => {
  const makeCtor = (formats: string[] | Error) => {
    const Ctor = function (this: object) {} as unknown as Parameters<typeof nativeQrDetector>[0] & object
    Object.assign(Ctor, {
      getSupportedFormats: () => (formats instanceof Error ? Promise.reject(formats) : Promise.resolve(formats)),
    })
    return Ctor
  }

  it('is used when the browser says it reads QR codes', async () => {
    expect(await nativeQrDetector(makeCtor(['ean_13', 'qr_code']))).not.toBeNull()
  })

  it('is skipped when QR is not supported, so jsQR does the work', async () => {
    expect(await nativeQrDetector(makeCtor([]))).toBeNull()
    expect(await nativeQrDetector(makeCtor(new Error('unsupported')))).toBeNull()
    expect(await nativeQrDetector(undefined)).toBeNull()
  })
})

describe('jsQR fallback on a light-on-dark pass', () => {
  it('reads an inverted QR code when both colours are tried', () => {
    const link = `https://eventcheckin-five.vercel.app/badge/${TOKEN}`
    const qr = QRCode.create(link, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const m = 6
    const side = (n + 8) * m
    const data = new Uint8ClampedArray(side * side * 4).fill(0)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (!qr.modules.get(x, y)) continue
        for (let dy = 0; dy < m; dy++)
          for (let dx = 0; dx < m; dx++) {
            const i = (((y + 4) * m + dy) * side + (x + 4) * m + dx) * 4
            data[i] = data[i + 1] = data[i + 2] = 255
          }
      }
    expect(jsQR(data, side, side, { inversionAttempts: 'dontInvert' })).toBeNull()
    expect(jsQR(data, side, side, { inversionAttempts: 'attemptBoth' })?.data).toBe(link)
  })
})
