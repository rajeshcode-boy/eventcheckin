// Guest list helpers: column mapping, duplicate detection, registration IDs.
// Pure functions (no Supabase) so they can be unit tested.

// Name: map First name + Last name, or a single Full name column.
// Emails: `email` is the personal address, `company_email` the corporate one;
// a single email column is sorted by domain (see classifyEmails).
export const GUEST_FIELDS = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'full_name', label: 'Full name (if no first/last)' },
  { key: 'company_email', label: 'Email (corporate)' },
  { key: 'email', label: 'Personal email' },
  { key: 'phone', label: 'Phone' },
  { key: 'designation', label: 'Designation' },
  { key: 'company', label: 'Company' },
  { key: 'source_id', label: 'Source ID (e.g. Jotform submission)' },
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
  first_name: ['firstname', 'givenname', 'fname'],
  last_name: ['lastname', 'surname', 'familyname', 'lname'],
  full_name: ['fullname', 'name', 'guestname', 'attendeename', 'participantname', 'yourname'],
  company_email: ['email', 'emailaddress', 'emailid', 'mail', 'companyemail', 'workemail', 'officeemail', 'businessemail', 'corporateemail'],
  email: ['personalemail', 'privateemail', 'homeemail'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contactnumber', 'contact', 'whatsapp', 'cell'],
  designation: ['designation', 'title', 'jobtitle', 'role', 'position'],
  company: ['company', 'companyname', 'organization', 'organisation', 'org', 'employer'],
  source_id: ['sourceid', 'submissionid', 'id', 'registrationno', 'ticketid', 'orderid'],
}

// Free/personal mailbox providers; anything else counts as corporate
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.in', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'zoho.com', 'zohomail.com', 'zohomail.in', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'yandex.ru',
  'rediffmail.com', 'rediff.com', 'qq.com', '163.com', '126.com', 'hey.com', 'fastmail.com', 'tutanota.com',
])

export function isPersonalEmail(email: string): boolean {
  const domain = email.toLowerCase().trim().split('@')[1] ?? ''
  return PERSONAL_EMAIL_DOMAINS.has(domain)
}

// Puts a personal address in `email` and a corporate one in `company_email`
export function classifyEmails(guest: GuestInput): GuestInput {
  const result = { ...guest }
  const all = [guest.company_email, guest.email].filter((e): e is string => !!e).map(normalizeGuestEmail)
  delete result.email
  delete result.company_email
  for (const e of all) {
    if (isPersonalEmail(e)) result.email ??= e
    else result.company_email ??= e
  }
  // Two addresses of the same kind: keep the extra one in the other slot
  for (const e of all) {
    if (e !== result.email && e !== result.company_email) {
      if (!result.email) result.email = e
      else if (!result.company_email) result.company_email = e
    }
  }
  return result
}

// Fills full_name from first/last, or splits a full name into first/last
export function completeName(guest: GuestInput): GuestInput {
  const result = { ...guest }
  if (result.first_name || result.last_name) {
    result.full_name = [result.first_name, result.last_name].filter(Boolean).join(' ')
  } else if (result.full_name) {
    const [first, ...rest] = result.full_name.split(/\s+/)
    result.first_name = first
    if (rest.length) result.last_name = rest.join(' ')
  }
  return result
}

export function guestEmails(guest: GuestInput): string[] {
  return [guest.email, guest.company_email].filter((e): e is string => !!e).map(normalizeGuestEmail)
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

  return mapping
}

// The import needs a name: full name, or first and/or last name
export function mappingHasName(mapping: (GuestField | '')[]): boolean {
  return mapping.some((f) => f === 'full_name' || f === 'first_name' || f === 'last_name')
}

export function rowsToGuests(
  headers: string[],
  rows: string[][],
  mapping: (GuestField | '')[]
): GuestInput[] {
  return rows
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const guest: GuestInput = {}
      mapping.forEach((field, i) => {
        if (!field) return
        const value = String(row[i] ?? '').trim()
        if (value) guest[field] = value
      })
      return classifyEmails(completeName(guest))
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
    for (const e of guestEmails(g)) existingByEmail.set(e, g)
    const key = nameCompanyKey(g)
    if (key) existingByNameCompany.set(key, g)
  }

  const rowByEmail = new Map<string, number>()
  const rowByNameCompany = new Map<string, number>()
  const conflicts: DuplicateConflict[] = []

  rows.forEach((row, rowIndex) => {
    const emails = guestEmails(row)
    const key = nameCompanyKey(row)
    const existingEmail = emails.find((e) => existingByEmail.has(e))
    const rowEmail = emails.find((e) => rowByEmail.has(e))

    let conflict: DuplicateConflict | null = null
    if (existingEmail) {
      conflict = { rowIndex, reason: 'email', match: { kind: 'existing', guest: existingByEmail.get(existingEmail)! } }
    } else if (rowEmail) {
      conflict = { rowIndex, reason: 'email', match: { kind: 'row', rowIndex: rowByEmail.get(rowEmail)! } }
    } else if (key && existingByNameCompany.has(key)) {
      conflict = { rowIndex, reason: 'name+company', match: { kind: 'existing', guest: existingByNameCompany.get(key)! } }
    } else if (key && rowByNameCompany.has(key)) {
      conflict = { rowIndex, reason: 'name+company', match: { kind: 'row', rowIndex: rowByNameCompany.get(key)! } }
    }
    if (conflict) conflicts.push(conflict)

    for (const e of emails) if (!rowByEmail.has(e)) rowByEmail.set(e, rowIndex)
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
    const badEmail = guestEmails(guest).find((e) => !isValidEmail(e))
    if (badEmail) {
      skipped.push({ rowIndex, reason: `Invalid email "${badEmail}"` })
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
  const header = ['Registration ID', 'First name', 'Last name', 'Corporate email', 'Personal email', 'Phone', 'Designation', 'Company', 'Source', 'Source ID']
  return [
    header,
    ...guests.map((g) => [
      g.registration_id,
      g.first_name ?? g.full_name,
      g.last_name ?? '',
      g.company_email ?? '',
      g.email ?? '',
      g.phone ?? '',
      g.designation ?? '',
      g.company ?? '',
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
