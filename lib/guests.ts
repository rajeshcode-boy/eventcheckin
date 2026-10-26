// Guest list helpers: column mapping, duplicate detection, registration IDs.
// Pure functions (no Supabase) so they can be unit tested.

export const GUEST_FIELDS = [
  { key: 'full_name', label: 'Full name', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'designation', label: 'Designation', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'company_email', label: 'Company email', required: false },
  { key: 'source_id', label: 'Source ID (e.g. Jotform submission)', required: false },
] as const

export type GuestField = (typeof GUEST_FIELDS)[number]['key']
export type GuestInput = Partial<Record<GuestField, string>>

export interface Guest extends GuestInput {
  id: string
  registration_id: string
  full_name: string
  source: 'import' | 'manual' | 'walkin'
  created_at?: string
}

// Header spellings recognised automatically (compared after normalizeHeader)
const HEADER_ALIASES: Record<GuestField, string[]> = {
  full_name: ['fullname', 'name', 'guestname', 'attendeename', 'participantname', 'yourname'],
  email: ['email', 'emailaddress', 'emailid', 'mail', 'personalemail'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber', 'contact', 'whatsapp', 'cell'],
  designation: ['designation', 'title', 'jobtitle', 'role', 'position'],
  company: ['company', 'companyname', 'organization', 'organisation', 'org', 'employer'],
  company_email: ['companyemail', 'workemail', 'officeemail', 'businessemail'],
  source_id: ['sourceid', 'submissionid', 'id', 'registrationno', 'ticketid', 'orderid'],
}

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Maps each file column index to a guest field (or '' to ignore).
// `remembered` holds header -> field choices saved from a previous upload.
export function autoMapColumns(
  headers: string[],
  remembered: Record<string, string> = {}
): (GuestField | '')[] {
  const used = new Set<string>()
  const mapping = headers.map((header) => {
    const saved = remembered[normalizeHeader(header)]
    if (saved && GUEST_FIELDS.some((f) => f.key === saved) && !used.has(saved)) {
      used.add(saved)
      return saved as GuestField
    }
    return '' as GuestField | ''
  })

  headers.forEach((header, i) => {
    if (mapping[i] || remembered[normalizeHeader(header)] === '') return
    const norm = normalizeHeader(header)
    const field = (Object.keys(HEADER_ALIASES) as GuestField[]).find(
      (f) => !used.has(f) && HEADER_ALIASES[f].includes(norm)
    )
    if (field) {
      used.add(field)
      mapping[i] = field
    }
  })

  // "First name" + "Last name" columns: map first name to full_name; rowsToGuests joins them
  if (!used.has('full_name')) {
    const first = headers.findIndex((h) => ['firstname', 'givenname'].includes(normalizeHeader(h)))
    if (first >= 0) mapping[first] = 'full_name'
  }

  return mapping
}

export function rowsToGuests(
  headers: string[],
  rows: string[][],
  mapping: (GuestField | '')[]
): GuestInput[] {
  const lastNameCol = headers.findIndex((h) => ['lastname', 'surname', 'familyname'].includes(normalizeHeader(h)))
  const nameIsFirstName = mapping.some(
    (f, i) => f === 'full_name' && ['firstname', 'givenname'].includes(normalizeHeader(headers[i] ?? ''))
  )

  return rows
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const guest: GuestInput = {}
      mapping.forEach((field, i) => {
        if (!field) return
        const value = String(row[i] ?? '').trim()
        if (value) guest[field] = value
      })
      if (nameIsFirstName && lastNameCol >= 0 && !mapping[lastNameCol]) {
        const last = String(row[lastNameCol] ?? '').trim()
        if (last) guest.full_name = [guest.full_name, last].filter(Boolean).join(' ')
      }
      if (guest.email) guest.email = normalizeGuestEmail(guest.email)
      if (guest.company_email) guest.company_email = normalizeGuestEmail(guest.company_email)
      return guest
    })
}

export function normalizeGuestEmail(email: string): string {
  return email.toLowerCase().trim()
}

// Key for "same person" matching by name + company (case and spacing ignored)
export function nameCompanyKey(guest: GuestInput): string | null {
  const name = guest.full_name?.toLowerCase().replace(/\s+/g, ' ').trim()
  const company = guest.company?.toLowerCase().replace(/\s+/g, ' ').trim()
  return name && company ? `${name}|${company}` : null
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export type DuplicateReason = 'email' | 'name+company'
export type Resolution = 'first' | 'second' | 'both'

export interface DuplicateConflict {
  rowIndex: number
  reason: DuplicateReason
  // The earlier record this row matches: an existing guest or an earlier row in the file
  match: { kind: 'existing'; guest: Guest } | { kind: 'row'; rowIndex: number }
}

// Finds rows that duplicate an existing guest or an earlier row in the same file.
// Email matches take precedence over name+company matches.
export function findDuplicates(rows: GuestInput[], existing: Guest[]): DuplicateConflict[] {
  const existingByEmail = new Map<string, Guest>()
  const existingByNameCompany = new Map<string, Guest>()
  for (const g of existing) {
    if (g.email) existingByEmail.set(normalizeGuestEmail(g.email), g)
    const key = nameCompanyKey(g)
    if (key) existingByNameCompany.set(key, g)
  }

  const rowByEmail = new Map<string, number>()
  const rowByNameCompany = new Map<string, number>()
  const conflicts: DuplicateConflict[] = []

  rows.forEach((row, rowIndex) => {
    const email = row.email ? normalizeGuestEmail(row.email) : null
    const key = nameCompanyKey(row)

    let conflict: DuplicateConflict | null = null
    if (email && existingByEmail.has(email)) {
      conflict = { rowIndex, reason: 'email', match: { kind: 'existing', guest: existingByEmail.get(email)! } }
    } else if (email && rowByEmail.has(email)) {
      conflict = { rowIndex, reason: 'email', match: { kind: 'row', rowIndex: rowByEmail.get(email)! } }
    } else if (key && existingByNameCompany.has(key)) {
      conflict = { rowIndex, reason: 'name+company', match: { kind: 'existing', guest: existingByNameCompany.get(key)! } }
    } else if (key && rowByNameCompany.has(key)) {
      conflict = { rowIndex, reason: 'name+company', match: { kind: 'row', rowIndex: rowByNameCompany.get(key)! } }
    }
    if (conflict) conflicts.push(conflict)

    if (email && !rowByEmail.has(email)) rowByEmail.set(email, rowIndex)
    if (key && !rowByNameCompany.has(key)) rowByNameCompany.set(key, rowIndex)
  })

  return conflicts
}

// "Keep both" is impossible for email duplicates: emails are unique per event in the DB
export function allowedResolutions(conflict: DuplicateConflict): Resolution[] {
  return conflict.reason === 'email' ? ['first', 'second'] : ['first', 'second', 'both']
}

export interface ImportPlan {
  inserts: { rowIndex: number; guest: GuestInput }[]
  updates: { guestId: string; rowIndex: number; guest: GuestInput }[]
  skipped: { rowIndex: number; reason: string }[]
}

// Applies duplicate resolutions (default: keep first) and drops rows without a name.
export function planImport(
  rows: GuestInput[],
  conflicts: DuplicateConflict[],
  resolutions: Record<number, Resolution>
): ImportPlan {
  const conflictByRow = new Map(conflicts.map((c) => [c.rowIndex, c]))
  const inserts = new Map<number, GuestInput>()
  const updates = new Map<string, { rowIndex: number; guest: GuestInput }>()
  const skipped: ImportPlan['skipped'] = []

  rows.forEach((guest, rowIndex) => {
    if (!guest.full_name) {
      skipped.push({ rowIndex, reason: 'Missing full name' })
      return
    }
    if (guest.email && !isValidEmail(guest.email)) {
      skipped.push({ rowIndex, reason: `Invalid email "${guest.email}"` })
      return
    }

    const conflict = conflictByRow.get(rowIndex)
    if (!conflict) {
      inserts.set(rowIndex, guest)
      return
    }

    const resolution = resolutions[rowIndex] ?? 'first'
    if (resolution === 'first') {
      skipped.push({ rowIndex, reason: `Duplicate (${conflict.reason}), kept the first` })
    } else if (resolution === 'both') {
      inserts.set(rowIndex, guest)
    } else if (conflict.match.kind === 'existing') {
      updates.set(conflict.match.guest.id, { rowIndex, guest })
    } else {
      const earlier = conflict.match.rowIndex
      if (inserts.delete(earlier)) {
        skipped.push({ rowIndex: earlier, reason: `Duplicate (${conflict.reason}), replaced by row ${rowIndex + 2}` })
      }
      inserts.set(rowIndex, guest)
    }
  })

  return {
    inserts: [...inserts].map(([rowIndex, guest]) => ({ rowIndex, guest })),
    updates: [...updates].map(([guestId, u]) => ({ guestId, ...u })),
    skipped: skipped.sort((a, b) => a.rowIndex - b.rowIndex),
  }
}

const REG_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// 6-char registration ID not already in `taken` (which is updated)
export function newRegistrationId(taken: Set<string>): string {
  for (;;) {
    let id = ''
    for (let i = 0; i < 6; i++) {
      id += REG_ID_CHARS.charAt(Math.floor(Math.random() * REG_ID_CHARS.length))
    }
    if (!taken.has(id)) {
      taken.add(id)
      return id
    }
  }
}

export function guestsToCsvRows(guests: Guest[]): string[][] {
  const header = ['Registration ID', 'Full name', 'Email', 'Phone', 'Designation', 'Company', 'Company email', 'Source', 'Source ID']
  return [
    header,
    ...guests.map((g) => [
      g.registration_id,
      g.full_name,
      g.email ?? '',
      g.phone ?? '',
      g.designation ?? '',
      g.company ?? '',
      g.company_email ?? '',
      g.source,
      g.source_id ?? '',
    ]),
  ]
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          // Neutralise spreadsheet formulas in exported cells (phone numbers like +91 98... stay as-is)
          const safe = /^[=@]|^[+-](?![\d\s()-]*$)/.test(cell) ? `'${cell}` : cell
          return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
        })
        .join(',')
    )
    .join('\r\n')
}
