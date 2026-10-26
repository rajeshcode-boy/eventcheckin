import {
  MM_TO_PT, SAMPLE_BADGE_DATA, badgeDataFor, defaultDesign, elementText, imagePathFor, layoutText, parseDesign,
  resizeDesign, rotateDesign, sheetGrid, textElement, wrapText,
} from '../lib/badgeDesign'
import { checkImageRules, detectImageType, publicImageUrl } from '../lib/images'

// Simple monospace measure: each character is 0.5 × the font size wide
const mono = (t: string, size: number) => t.length * size * 0.5

describe('badge text layout', () => {
  test('keeps the requested size when the text fits on one line', () => {
    expect(layoutText('Priya Sharma', 200, 30, 20, 8, mono)).toEqual({ lines: ['Priya Sharma'], size: 20 })
  })

  test('shrinks long text before wrapping it', () => {
    const out = layoutText('Venkata Subramanian Ramakrishnan', 160, 20, 20, 8, mono)
    expect(out.lines).toHaveLength(1)
    expect(out.size).toBeLessThan(20)
    expect(mono(out.lines[0]!, out.size)).toBeLessThanOrEqual(160)
  })

  test('wraps onto more lines when the box is tall enough', () => {
    const out = layoutText('Senior Vice President Global Partnerships', 100, 60, 12, 12, mono)
    expect(out.size).toBe(12)
    expect(out.lines.length).toBeGreaterThan(1)
    out.lines.forEach((l) => expect(mono(l, 12)).toBeLessThanOrEqual(100))
  })

  test('cuts text with "..." when it cannot fit at the minimum size', () => {
    const out = layoutText('word '.repeat(50), 50, 12, 10, 10, mono)
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0]!.endsWith('...')).toBe(true)
  })

  test('splits a single word wider than the box', () => {
    expect(wrapText('ABCDEFGHIJ', 20, (t) => t.length * 5)).toEqual(['ABCD', 'EFGH', 'IJ'])
  })
})

describe('badge designs', () => {
  test('the default template is valid and survives a save/load round trip', () => {
    const d = defaultDesign()
    expect(d.elements.length).toBeGreaterThan(5)
    expect(parseDesign(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })

  test('parseDesign rejects bad values instead of trusting stored JSON', () => {
    const d = parseDesign({
      widthMm: 9999, heightMm: 'x', background: { color: 'red', imagePath: '../../etc/passwd' },
      elements: [{ type: 'text', x: 1, y: 1, w: 10, h: 5, color: 'javascript:1', size: 500, field: 'password' }, { type: 'script' }],
    })
    expect(d.widthMm).toBe(300)
    expect(d.heightMm).toBe(76.2)
    expect(d.background).toEqual({ color: '#ffffff', imagePath: null })
    expect(d.elements).toHaveLength(1)
    expect(d.elements[0]).toMatchObject({ type: 'text', color: '#111827', size: 120, field: 'full_name' })
  })

  test('rotating swaps the sides and keeps elements inside the badge', () => {
    const d = rotateDesign(defaultDesign())
    expect(d.widthMm).toBeCloseTo(76.2)
    expect(d.heightMm).toBeCloseTo(101.6)
    d.elements.forEach((e) => expect(e.x + e.w).toBeLessThanOrEqual(d.widthMm + 0.01))
  })

  test('resizing scales elements proportionally', () => {
    const d = resizeDesign(defaultDesign(), 203.2, 152.4)
    expect(d.elements[0]!.w).toBeCloseTo(203.2)
  })

  test('text elements show attendee values or static text', () => {
    expect(elementText(textElement({ x: 0, y: 0, w: 1, h: 1, field: 'company', uppercase: true }), SAMPLE_BADGE_DATA)).toBe('ACME TECHNOLOGIES')
    expect(elementText(textElement({ x: 0, y: 0, w: 1, h: 1, source: 'static', text: 'SPEAKER' }), SAMPLE_BADGE_DATA)).toBe('SPEAKER')
  })

  test('event logo falls back to the organization logo', () => {
    expect(imagePathFor({ source: 'event_logo', path: null }, { eventLogoPath: null, orgLogoPath: 'org/logo.png' })).toBe('org/logo.png')
    expect(imagePathFor({ source: 'sponsor', path: 'org/s.png' }, { eventLogoPath: 'e.png', orgLogoPath: null })).toBe('org/s.png')
  })

  test('badge data uses readable country and status names', () => {
    const data = badgeDataFor(
      { full_name: 'Omar Ali', registration_id: 'ZLX5JB', country: 'AE', registration_status: 'approved' },
      { name: 'Tech Fest', event_date: '2026-11-15', location: 'Dubai', city: 'Dubai', country: 'AE' }
    )
    expect(data).toMatchObject({ country: 'United Arab Emirates', registration_type: 'Approved', event_location: 'Dubai, United Arab Emirates', first_name: 'Omar' })
  })
})

describe('sheet layout', () => {
  test('4 × 3 in badges fit 4 to an A4 sheet by turning it landscape', () => {
    // Portrait fits only 3 (two side by side need 207.2 mm of 190 mm usable width)
    const g = sheetGrid('A4', 101.6, 76.2)
    expect(g.perPage).toBe(4)
    expect(g.page).toEqual({ w: 297, h: 210 })
    g.slots.forEach((s) => {
      expect(s.x).toBeGreaterThanOrEqual(10)
      expect(s.x + 101.6).toBeLessThanOrEqual(297 - 10)
      expect(s.y + 76.2).toBeLessThanOrEqual(210 - 10)
    })
  })

  test('CR80 cards fit 9 to an A4 sheet (3 × 3, landscape)', () => {
    expect(sheetGrid('A4', 85.6, 54).perPage).toBe(9)
  })

  test('a badge larger than the paper fits zero per sheet', () => {
    expect(sheetGrid('A4', 280, 250).perPage).toBe(0)
  })

  test('millimetre to point conversion', () => {
    expect(25.4 * MM_TO_PT).toBeCloseTo(72)
  })
})

describe('image validation', () => {
  test('detects PNG, JPEG and WebP from file contents, not names', () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
    expect(detectImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
    expect(detectImageType(new TextEncoder().encode('GIF89a'))).toBeNull()
  })

  test('size and dimension limits', () => {
    const rules = { maxBytes: 1000, minWidth: 100, minHeight: 100, maxWidth: 500, maxHeight: 500 }
    expect(checkImageRules(500, 200, 200, rules)).toBeNull()
    expect(checkImageRules(5000, 200, 200, rules)).toMatch(/limit/)
    expect(checkImageRules(500, 50, 200, rules)).toMatch(/at least 100px/)
    expect(checkImageRules(500, 200, 900, rules)).toMatch(/limit is 500px/)
  })

  test('public URLs encode each path segment', () => {
    expect(publicImageUrl('branding', 'org/events/a b.png')).toBe('https://example.supabase.co/storage/v1/object/public/branding/org/events/a%20b.png')
    expect(publicImageUrl('avatars', null)).toBeNull()
  })
})
