import type { QueuedScan, SyncResult } from './types'

export const BATCH_SIZE = 50

export interface SyncDeps {
  getQueue: () => Promise<QueuedScan[]>
  dequeue: (scanId: string) => Promise<unknown>
  post: (scans: QueuedScan[]) => Promise<SyncResult[]>
}

export type FlushOutcome =
  | { ok: true; results: SyncResult[] }
  | { ok: false; reason: 'offline' | 'revoked'; results: SyncResult[] }

// Uploads queued scans oldest first, in batches. A scan leaves the queue only after the server
// has answered for it (checked in, already checked in elsewhere, or unknown guest), so a dropped
// connection mid-batch just means the same scans are retried; the server de-duplicates by scan_id.
export async function flushQueue(deps: SyncDeps): Promise<FlushOutcome> {
  const all: SyncResult[] = []
  for (;;) {
    const queue = await deps.getQueue()
    if (queue.length === 0) return { ok: true, results: all }
    const batch = queue.slice(0, BATCH_SIZE)
    let results: SyncResult[]
    try {
      results = await deps.post(batch)
    } catch (e) {
      return { ok: false, reason: (e as Error).message === 'revoked' ? 'revoked' : 'offline', results: all }
    }
    const answered = new Set(results.map((r) => r.scan_id))
    for (const scan of batch) if (answered.has(scan.scan_id)) await deps.dequeue(scan.scan_id)
    all.push(...results)
    if (answered.size === 0) return { ok: false, reason: 'offline', results: all }
  }
}

// "Already checked in at 10:14 AM by Gate 2"
export function describeConflict(r: Pick<SyncResult, 'checked_in_at' | 'by_kiosk'>, labels: Record<string, string> = {}): string {
  const time = r.checked_in_at
    ? new Date(r.checked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'earlier'
  const by = r.by_kiosk ? (labels[r.by_kiosk] ?? r.by_kiosk) : 'the desk'
  return `Already checked in at ${time} by ${by}`
}

export const RESCAN_WINDOW_MS = 15000

// The camera keeps reading a QR code that is still in front of it. A guest this kiosk checked in a
// moment ago is the same scan again, not a conflict, so it should be ignored instead of shown as
// "already checked in" over the success banner.
export function isOwnRecentCheckin(
  g: { checked_in_at: string | null; checked_in_by: string | null },
  kioskCode: string,
  now = Date.now()
): boolean {
  if (!g.checked_in_at || g.checked_in_by !== kioskCode) return false
  const age = now - new Date(g.checked_in_at).getTime()
  return age >= 0 && age < RESCAN_WINDOW_MS
}
