// Post-event attendance report (Step 6): shared rows for Excel, CSV and PDF export.
import { formatDateTime } from './time'

export interface ReportRegistration {
  id: string
  registration_id: string
  source: 'import' | 'manual' | 'walkin'
  full_name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  company_email: string | null
  phone: string | null
  designation: string | null
  company: string | null
}

export interface ReportCheckin {
  registration_id: string
  checked_in_at: string
}

export type AttendanceStatus = 'Checked in' | 'Not arrived' | 'No-show'

export interface ReportRow {
  registrationId: string
  firstName: string
  lastName: string
  corporateEmail: string
  personalEmail: string
  phone: string
  company: string
  designation: string
  source: string
  status: AttendanceStatus
  checkInTime: string
}

export const REPORT_HEADERS = [
  'Reg ID', 'First name', 'Last name', 'Corporate email', 'Personal email', 'Phone',
  'Company', 'Designation', 'Source', 'Status', 'Check-in time',
]

const SOURCE_LABELS = { import: 'Imported', manual: 'Manual', walkin: 'Walk-in' } as const

export function buildReport(registrations: ReportRegistration[], checkins: ReportCheckin[], closed: boolean) {
  // Earliest check-in per registration
  const firstCheckin = new Map<string, string>()
  for (const c of checkins) {
    const prev = firstCheckin.get(c.registration_id)
    if (!prev || c.checked_in_at < prev) firstCheckin.set(c.registration_id, c.checked_in_at)
  }

  const rows: ReportRow[] = registrations
    .map((r) => {
      const at = firstCheckin.get(r.id)
      return {
        registrationId: r.registration_id,
        firstName: r.first_name ?? r.full_name,
        lastName: r.last_name ?? '',
        corporateEmail: r.company_email ?? '',
        personalEmail: r.email ?? '',
        phone: r.phone ?? '',
        company: r.company ?? '',
        designation: r.designation ?? '',
        source: SOURCE_LABELS[r.source],
        status: (at ? 'Checked in' : closed ? 'No-show' : 'Not arrived') as AttendanceStatus,
        checkInTime: at ? formatDateTime(at) : '',
        sortKey: at ?? '',
      }
    })
    .sort((a, b) => (a.sortKey && b.sortKey ? a.sortKey.localeCompare(b.sortKey) : a.sortKey ? -1 : b.sortKey ? 1 : a.firstName.localeCompare(b.firstName)))
    .map(({ sortKey: _sortKey, ...row }) => row)

  const preRegistered = rows.filter((r) => r.source !== 'Walk-in')
  const attended = preRegistered.filter((r) => r.status === 'Checked in')
  const walkins = rows.filter((r) => r.source === 'Walk-in')
  const absent = preRegistered.filter((r) => r.status !== 'Checked in')

  const summary: [string, string][] = [
    ['Total registered', String(rows.length)],
    ['Pre-registered', String(preRegistered.length)],
    ['Attended (pre-registered)', `${attended.length} (${preRegistered.length ? Math.round((attended.length / preRegistered.length) * 100) : 0}%)`],
    ['Walk-ins', String(walkins.length)],
    ['Total attended', String(attended.length + walkins.length)],
    [closed ? 'No-shows' : 'Not yet arrived', String(absent.length)],
    ['Check-in status', closed ? 'Closed' : 'Open'],
  ]

  return { rows, attended, walkins, absent, summary }
}

export function rowToCells(r: ReportRow): string[] {
  return [
    r.registrationId, r.firstName, r.lastName, r.corporateEmail, r.personalEmail, r.phone,
    r.company, r.designation, r.source, r.status, r.checkInTime,
  ]
}
