export interface KioskGuest {
  id: string
  registration_id: string
  full_name: string
  email: string | null
  company: string | null
  designation: string | null
  badge_hash: string
  checked_in_at: string | null
  checked_in_by: string | null
}

export interface KioskSession {
  token: string
  kioskCode: string
  label: string
  eventName: string
}

export interface QueuedScan {
  scan_id: string
  registration_uuid: string
  scanned_at: string
  method: 'qr' | 'manual'
  full_name: string
}

export type SyncStatus = 'checked_in' | 'already_checked_in' | 'not_found'

export interface SyncResult {
  scan_id: string
  status: SyncStatus
  registration_uuid?: string
  full_name?: string
  checked_in_at?: string
  by_kiosk?: string
}
