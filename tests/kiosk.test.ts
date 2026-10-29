import { matchScan, searchGuests, sha256Hex } from '../lib/kiosk/search'
import { BATCH_SIZE, describeConflict, flushQueue, isOwnRecentCheckin, RESCAN_WINDOW_MS } from '../lib/kiosk/sync'
import type { KioskGuest, QueuedScan, SyncResult } from '../lib/kiosk/types'

const guest = (over: Partial<KioskGuest>): KioskGuest => ({
  id: 'g1', registration_id: 'A7K9Q2', full_name: 'Aditi Rao', email: 'aditi@example.com', company: 'Acme',
  designation: null, badge_hash: 'h', checked_in_at: null, checked_in_by: null, ...over,
})
const guests = [
  guest({ id: '1', registration_id: 'A7K9Q2', full_name: 'Aditi Rao', email: 'aditi@example.com' }),
  guest({ id: '2', registration_id: 'B2C3D4', full_name: 'Ben Clarke', email: 'ben@example.com' }),
  guest({ id: '3', registration_id: 'ZZ99XX', full_name: 'Chen Wei', email: 'chen@corp.io' }),
]

describe('searchGuests', () => {
  it('matches by confirmation code first', () => expect(searchGuests(guests, 'b2c3d4')[0]?.id).toBe('2'))
  it('matches by name prefix and by email', () => {
    expect(searchGuests(guests, 'adi')[0]?.id).toBe('1')
    expect(searchGuests(guests, 'chen@corp.io')[0]?.id).toBe('3')
  })
  it('tolerates skipped letters', () => expect(searchGuests(guests, 'bnclrk')[0]?.id).toBe('2'))
  it('ignores accents and empty input', () => {
    expect(searchGuests([guest({ id: '9', full_name: 'José Ortiz' })], 'jose')[0]?.id).toBe('9')
    expect(searchGuests(guests, '  ')).toEqual([])
  })
})

describe('matchScan', () => {
  it('matches a badge link by token hash without needing the token in the roster', async () => {
    const token = 'a'.repeat(32)
    const list = [guest({ id: 'x', badge_hash: await sha256Hex(token) })]
    expect((await matchScan(list, `https://app.example.com/badge/${token}`))?.id).toBe('x')
    expect((await matchScan(list, token))?.id).toBe('x')
  })
  it('matches a registration id and rejects unknown input', async () => {
    expect((await matchScan(guests, ' a7k9q2 '))?.id).toBe('1')
    expect(await matchScan(guests, 'NOPE00')).toBeNull()
  })
})

const scan = (n: number): QueuedScan => ({
  scan_id: `s${n}`, registration_uuid: `r${n}`, scanned_at: new Date(2026, 0, 1, 10, n).toISOString(), method: 'manual', full_name: `G${n}`,
})

function fakeQueue(initial: QueuedScan[]) {
  let q = [...initial]
  return {
    get items() { return q },
    getQueue: async () => [...q],
    dequeue: async (id: string) => { q = q.filter((s) => s.scan_id !== id) },
  }
}

describe('flushQueue', () => {
  it('uploads in batches and empties the queue', async () => {
    const q = fakeQueue(Array.from({ length: BATCH_SIZE + 5 }, (_, i) => scan(i)))
    const sizes: number[] = []
    const out = await flushQueue({
      ...q,
      post: async (scans) => { sizes.push(scans.length); return scans.map((s): SyncResult => ({ scan_id: s.scan_id, status: 'checked_in' })) },
    })
    expect(out.ok).toBe(true)
    expect(sizes).toEqual([BATCH_SIZE, 5])
    expect(q.items).toHaveLength(0)
  })

  it('keeps everything queued when the connection drops', async () => {
    const q = fakeQueue([scan(1), scan(2)])
    const out = await flushQueue({ ...q, post: async () => { throw new Error('offline') } })
    expect(out).toMatchObject({ ok: false, reason: 'offline' })
    expect(q.items).toHaveLength(2)
  })

  it('reports a revoked kiosk and still dequeues conflicts the server answered', async () => {
    const q = fakeQueue([scan(1)])
    const out = await flushQueue({ ...q, post: async () => { throw new Error('revoked') } })
    expect(out).toMatchObject({ ok: false, reason: 'revoked' })

    const q2 = fakeQueue([scan(1)])
    const res = await flushQueue({
      ...q2,
      post: async (s) => s.map((x): SyncResult => ({ scan_id: x.scan_id, status: 'already_checked_in', by_kiosk: 'KSK-GATE-02', checked_in_at: '2026-01-01T10:14:00Z' })),
    })
    expect(res.results[0]?.status).toBe('already_checked_in')
    expect(q2.items).toHaveLength(0)
  })

  it('stops instead of looping when the server answers nothing', async () => {
    const q = fakeQueue([scan(1)])
    const out = await flushQueue({ ...q, post: async () => [] })
    expect(out.ok).toBe(false)
    expect(q.items).toHaveLength(1)
  })
})

describe('describeConflict', () => {
  it('names the kiosk and the time', () => {
    const text = describeConflict({ by_kiosk: 'KSK-GATE-02', checked_in_at: '2026-01-01T10:14:00Z' })
    expect(text).toMatch(/^Already checked in at .+ by KSK-GATE-02$/)
  })
  it('uses a friendly label when known and falls back to the desk', () => {
    expect(describeConflict({ by_kiosk: 'KSK-GATE-02', checked_in_at: '2026-01-01T10:14:00Z' }, { 'KSK-GATE-02': 'Gate 2' })).toContain('by Gate 2')
    expect(describeConflict({ checked_in_at: undefined })).toBe('Already checked in at earlier by the desk')
  })
})

describe('isOwnRecentCheckin', () => {
  const now = Date.parse('2026-01-01T10:00:30Z')
  const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString()

  it('ignores a rescan of someone this kiosk just checked in', () => {
    expect(isOwnRecentCheckin({ checked_in_at: at(5), checked_in_by: 'KSK-A' }, 'KSK-A', now)).toBe(true)
  })
  it('does not hide a real conflict later, or one made by another kiosk', () => {
    expect(isOwnRecentCheckin({ checked_in_at: at(RESCAN_WINDOW_MS / 1000 + 5), checked_in_by: 'KSK-A' }, 'KSK-A', now)).toBe(false)
    expect(isOwnRecentCheckin({ checked_in_at: at(5), checked_in_by: 'KSK-B' }, 'KSK-A', now)).toBe(false)
  })
  it('is false for guests not checked in', () => {
    expect(isOwnRecentCheckin({ checked_in_at: null, checked_in_by: null }, 'KSK-A', now)).toBe(false)
  })
})
