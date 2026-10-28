// Offline store for the kiosk: guest list and the queue of scans waiting to upload.
// Plain IndexedDB, no dependency. All functions reject if IndexedDB is unavailable.
import type { KioskGuest, QueuedScan } from './types'

const DB_NAME = 'eventcheckin-kiosk'
const VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('guests', { keyPath: 'id' })
      db.createObjectStore('queue', { keyPath: 'scan_id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const r = fn(t.objectStore(store))
    t.oncomplete = () => {
      db.close()
      resolve((r ? r.result : undefined) as T)
    }
    t.onerror = t.onabort = () => {
      db.close()
      reject(t.error)
    }
  })
}

export const getGuests = () => tx<KioskGuest[]>('guests', 'readonly', (s) => s.getAll())
export const replaceGuests = (guests: KioskGuest[]) =>
  tx('guests', 'readwrite', (s) => {
    s.clear()
    guests.forEach((g) => s.put(g))
  })
export const putGuest = (g: KioskGuest) => tx('guests', 'readwrite', (s) => s.put(g))

export const getQueue = async () =>
  (await tx<QueuedScan[]>('queue', 'readonly', (s) => s.getAll())).sort((a, b) => a.scanned_at.localeCompare(b.scanned_at))
export const enqueue = (scan: QueuedScan) => tx('queue', 'readwrite', (s) => s.put(scan))
export const dequeue = (scanId: string) => tx('queue', 'readwrite', (s) => s.delete(scanId))
export const clearAll = async () => {
  await tx('guests', 'readwrite', (s) => s.clear())
  await tx('queue', 'readwrite', (s) => s.clear())
}
