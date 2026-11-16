import { supabase } from '@/lib/supabase'

export interface Sponsor {
  id: string
  event_id: string
  name: string
  tier: string // Custom tier name!
  logo_url: string | null
  website: string | null
  booth_number: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  rep_pass_quota: number
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SponsorRep {
  id: string
  event_id: string
  sponsor_id: string
  full_name: string
  email: string | null
  phone: string | null
  role_title: string
  pass_code: string
  badge_token: string
  checked_in_at: string | null
  checked_in_by: string | null
  checkin_method: string | null
  created_at: string
  updated_at: string
}

export const DEFAULT_TIER_SUGGESTIONS = [
  'Title Partner',
  'Platinum Sponsor',
  'Gold Sponsor',
  'Silver Sponsor',
  'Bronze Sponsor',
  'Powered By',
  'Media Partner',
  'Community Partner',
  'Exhibitor',
]

const LOCAL_STORAGE_PREFIX = 'event_sponsors_'
const LOCAL_STORAGE_REPS_PREFIX = 'event_sponsor_reps_'

function getLocalSponsors(eventId: string): Sponsor[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${eventId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalSponsors(eventId: string, sponsors: Sponsor[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${eventId}`, JSON.stringify(sponsors))
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalSponsorReps(eventId: string): SponsorRep[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_REPS_PREFIX}${eventId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalSponsorReps(eventId: string, reps: SponsorRep[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${LOCAL_STORAGE_REPS_PREFIX}${eventId}`, JSON.stringify(reps))
  } catch {
    // Ignore storage quota errors
  }
}

export function generateRepPassCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = 'SP-'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function fetchSponsors(eventId: string): Promise<Sponsor[]> {
  try {
    const { data, error } = await supabase
      .from('event_sponsors')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      return getLocalSponsors(eventId)
    }

    const list: Sponsor[] = (data || []).map((row: any) => ({
      id: row.id,
      event_id: row.event_id,
      name: row.name,
      tier: row.tier || 'Partner',
      logo_url: row.logo_url,
      website: row.website,
      booth_number: row.booth_number,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      rep_pass_quota: Number(row.rep_pass_quota) || 2,
      notes: row.notes,
      sort_order: row.sort_order ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    saveLocalSponsors(eventId, list)
    return list
  } catch {
    return getLocalSponsors(eventId)
  }
}

export async function saveSponsor(eventId: string, sponsorData: Partial<Sponsor>): Promise<Sponsor> {
  const payload = {
    event_id: eventId,
    name: sponsorData.name?.trim() || 'Sponsor',
    tier: sponsorData.tier?.trim() || 'Partner',
    logo_url: sponsorData.logo_url || null,
    website: sponsorData.website?.trim() || null,
    booth_number: sponsorData.booth_number?.trim() || null,
    contact_name: sponsorData.contact_name?.trim() || null,
    contact_email: sponsorData.contact_email?.trim() || null,
    contact_phone: sponsorData.contact_phone?.trim() || null,
    rep_pass_quota: Number(sponsorData.rep_pass_quota) >= 0 ? Number(sponsorData.rep_pass_quota) : 2,
    notes: sponsorData.notes?.trim() || null,
    sort_order: sponsorData.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  }

  try {
    if (sponsorData.id) {
      const { data, error } = await supabase
        .from('event_sponsors')
        .update(payload)
        .eq('id', sponsorData.id)
        .select()
        .single()

      if (!error && data) {
        const updated = data as Sponsor
        const locals = getLocalSponsors(eventId).map((s) => (s.id === updated.id ? updated : s))
        saveLocalSponsors(eventId, locals)
        return updated
      }
    } else {
      const { data, error } = await supabase
        .from('event_sponsors')
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        const created = data as Sponsor
        const locals = [...getLocalSponsors(eventId), created]
        saveLocalSponsors(eventId, locals)
        return created
      }
    }
  } catch {
    // Fall back to local storage
  }

  const fallbackId = sponsorData.id || `local_spn_${Date.now()}`
  const sponsor: Sponsor = {
    id: fallbackId,
    event_id: eventId,
    name: payload.name,
    tier: payload.tier,
    logo_url: payload.logo_url,
    website: payload.website,
    booth_number: payload.booth_number,
    contact_name: payload.contact_name,
    contact_email: payload.contact_email,
    contact_phone: payload.contact_phone,
    rep_pass_quota: payload.rep_pass_quota,
    notes: payload.notes,
    sort_order: payload.sort_order,
    created_at: sponsorData.created_at || new Date().toISOString(),
    updated_at: payload.updated_at,
  }

  const current = getLocalSponsors(eventId)
  const exists = current.some((s) => s.id === sponsor.id)
  const updated = exists ? current.map((s) => (s.id === sponsor.id ? sponsor : s)) : [...current, sponsor]
  saveLocalSponsors(eventId, updated)
  return sponsor
}

export async function deleteSponsor(eventId: string, sponsorId: string): Promise<boolean> {
  try {
    await supabase.from('event_sponsors').delete().eq('id', sponsorId)
  } catch {
    // Ignore
  }
  const current = getLocalSponsors(eventId).filter((s) => s.id !== sponsorId)
  saveLocalSponsors(eventId, current)
  // Also clean up reps for this sponsor locally
  const remainingReps = getLocalSponsorReps(eventId).filter((r) => r.sponsor_id !== sponsorId)
  saveLocalSponsorReps(eventId, remainingReps)
  return true
}

// ==========================================
// SPONSOR BOOTH REPRESENTATIVES (REPS)
// ==========================================

export async function fetchSponsorReps(eventId: string, sponsorId?: string): Promise<SponsorRep[]> {
  try {
    let query = supabase
      .from('event_sponsor_reps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (sponsorId) {
      query = query.eq('sponsor_id', sponsorId)
    }

    const { data, error } = await query

    if (error) {
      const locals = getLocalSponsorReps(eventId)
      return sponsorId ? locals.filter((r) => r.sponsor_id === sponsorId) : locals
    }

    const list: SponsorRep[] = (data || []).map((row: any) => ({
      id: row.id,
      event_id: row.event_id,
      sponsor_id: row.sponsor_id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      role_title: row.role_title || 'Booth Staff',
      pass_code: row.pass_code,
      badge_token: row.badge_token || row.id,
      checked_in_at: row.checked_in_at,
      checked_in_by: row.checked_in_by,
      checkin_method: row.checkin_method,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    // Save to local cache
    if (!sponsorId) {
      saveLocalSponsorReps(eventId, list)
    } else {
      const otherReps = getLocalSponsorReps(eventId).filter((r) => r.sponsor_id !== sponsorId)
      saveLocalSponsorReps(eventId, [...otherReps, ...list])
    }
    return list
  } catch {
    const locals = getLocalSponsorReps(eventId)
    return sponsorId ? locals.filter((r) => r.sponsor_id === sponsorId) : locals
  }
}

export async function saveSponsorRep(
  eventId: string,
  sponsorId: string,
  repData: Partial<SponsorRep>
): Promise<SponsorRep> {
  const passCode = repData.pass_code || generateRepPassCode()
  const badgeToken = repData.badge_token || `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const payload = {
    event_id: eventId,
    sponsor_id: sponsorId,
    full_name: repData.full_name?.trim() || 'Staff Representative',
    email: repData.email?.trim() || null,
    phone: repData.phone?.trim() || null,
    role_title: repData.role_title?.trim() || 'Booth Staff',
    pass_code: passCode,
    badge_token: badgeToken,
    updated_at: new Date().toISOString(),
  }

  try {
    if (repData.id) {
      const { data, error } = await supabase
        .from('event_sponsor_reps')
        .update(payload)
        .eq('id', repData.id)
        .select()
        .single()

      if (!error && data) {
        const updated = data as SponsorRep
        const locals = getLocalSponsorReps(eventId).map((r) => (r.id === updated.id ? updated : r))
        saveLocalSponsorReps(eventId, locals)
        return updated
      }
    } else {
      const { data, error } = await supabase
        .from('event_sponsor_reps')
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        const created = data as SponsorRep
        const locals = [...getLocalSponsorReps(eventId), created]
        saveLocalSponsorReps(eventId, locals)
        return created
      }
    }
  } catch {
    // Local fallback
  }

  const fallbackId = repData.id || `local_rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const rep: SponsorRep = {
    id: fallbackId,
    event_id: eventId,
    sponsor_id: sponsorId,
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    role_title: payload.role_title,
    pass_code: payload.pass_code,
    badge_token: payload.badge_token,
    checked_in_at: repData.checked_in_at || null,
    checked_in_by: repData.checked_in_by || null,
    checkin_method: repData.checkin_method || null,
    created_at: repData.created_at || new Date().toISOString(),
    updated_at: payload.updated_at,
  }

  const current = getLocalSponsorReps(eventId)
  const exists = current.some((r) => r.id === rep.id)
  const updated = exists ? current.map((r) => (r.id === rep.id ? rep : r)) : [...current, rep]
  saveLocalSponsorReps(eventId, updated)
  return rep
}

export async function deleteSponsorRep(repId: string, eventId: string): Promise<boolean> {
  try {
    await supabase.from('event_sponsor_reps').delete().eq('id', repId)
  } catch {
    // Ignore
  }
  const current = getLocalSponsorReps(eventId).filter((r) => r.id !== repId)
  saveLocalSponsorReps(eventId, current)
  return true
}

export async function checkInSponsorRep(
  repId: string,
  eventId: string,
  staffName = 'Front Desk',
  method: 'manual' | 'qr' | 'kiosk' = 'manual'
): Promise<SponsorRep | null> {
  const now = new Date().toISOString()
  try {
    const { data, error } = await supabase
      .from('event_sponsor_reps')
      .update({
        checked_in_at: now,
        checked_in_by: staffName,
        checkin_method: method,
        updated_at: now,
      })
      .eq('id', repId)
      .select()
      .single()

    if (!error && data) {
      const updated = data as SponsorRep
      const locals = getLocalSponsorReps(eventId).map((r) => (r.id === updated.id ? updated : r))
      saveLocalSponsorReps(eventId, locals)
      return updated
    }
  } catch {
    // Local fallback
  }

  const current = getLocalSponsorReps(eventId)
  const target = current.find((r) => r.id === repId)
  if (!target) return null
  const updated: SponsorRep = {
    ...target,
    checked_in_at: now,
    checked_in_by: staffName,
    checkin_method: method,
    updated_at: now,
  }
  saveLocalSponsorReps(eventId, current.map((r) => (r.id === repId ? updated : r)))
  return updated
}

export async function undoSponsorRepCheckIn(repId: string, eventId: string): Promise<SponsorRep | null> {
  try {
    const { data, error } = await supabase
      .from('event_sponsor_reps')
      .update({
        checked_in_at: null,
        checked_in_by: null,
        checkin_method: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', repId)
      .select()
      .single()

    if (!error && data) {
      const updated = data as SponsorRep
      const locals = getLocalSponsorReps(eventId).map((r) => (r.id === updated.id ? updated : r))
      saveLocalSponsorReps(eventId, locals)
      return updated
    }
  } catch {
    // Local fallback
  }

  const current = getLocalSponsorReps(eventId)
  const target = current.find((r) => r.id === repId)
  if (!target) return null
  const updated: SponsorRep = {
    ...target,
    checked_in_at: null,
    checked_in_by: null,
    checkin_method: null,
    updated_at: new Date().toISOString(),
  }
  saveLocalSponsorReps(eventId, current.map((r) => (r.id === repId ? updated : r)))
  return updated
}

/**
 * Exports sponsor delegations to a CSV string.
 * Strictly separates sponsor contacts from general guest downloads.
 */
export function exportSponsorRepsToCsv(sponsors: Sponsor[], reps: SponsorRep[]): string {
  const sponsorMap = new Map<string, Sponsor>()
  for (const s of sponsors) {
    sponsorMap.set(s.id, s)
  }

  const headers = [
    'Sponsor Company',
    'Tier',
    'Booth Number',
    'Rep Full Name',
    'Role / Title',
    'Email Address',
    'Phone Number',
    'Pass Code',
    'Check-in Status',
    'Checked-in Time',
    'Checked-in By',
  ]

  const rows = reps.map((rep) => {
    const sponsor = sponsorMap.get(rep.sponsor_id)
    return [
      sponsor?.name || 'Unknown Sponsor',
      sponsor?.tier || 'Partner',
      sponsor?.booth_number || 'TBA',
      rep.full_name,
      rep.role_title,
      rep.email || '',
      rep.phone || '',
      rep.pass_code,
      rep.checked_in_at ? 'Attended / Checked In' : 'Not Arrived Yet',
      rep.checked_in_at ? new Date(rep.checked_in_at).toLocaleTimeString() : '',
      rep.checked_in_by || '',
    ]
  })

  const escapeCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }

  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n')
}
