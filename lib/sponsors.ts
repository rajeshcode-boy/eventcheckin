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
  return true
}
