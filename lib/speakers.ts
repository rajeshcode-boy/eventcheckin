import { supabase } from '@/lib/supabase'

export interface Speaker {
  id: string
  event_id: string
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  designation: string | null
  bio: string | null
  photo_url: string | null
  talk_title: string | null
  session_type: string // 'Keynote' | 'Panel' | 'Breakout' | 'Workshop' | 'Fireside Chat' | 'Lightning Talk' | 'Other'
  stage_room: string | null // e.g. 'Main Auditorium'
  session_time: string | null // e.g. '10:00 AM - 10:45 AM'
  registration_id: string | null // Linked attendee ID
  featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // Optional populated registration / pass details
  pass_code?: string | null
  badge_token?: string | null
}

const LOCAL_STORAGE_PREFIX = 'event_speakers_'

function getLocalSpeakers(eventId: string): Speaker[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${eventId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalSpeakers(eventId: string, speakers: Speaker[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${eventId}`, JSON.stringify(speakers))
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchSpeakers(eventId: string): Promise<Speaker[]> {
  try {
    const { data, error } = await supabase
      .from('event_speakers')
      .select('*, registrations(id, registration_id, badge_token)')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      // If table doesn't exist yet, fall back gracefully to local persistence
      const local = getLocalSpeakers(eventId)
      return local
    }

    const list: Speaker[] = (data || []).map((row: any) => ({
      id: row.id,
      event_id: row.event_id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      designation: row.designation,
      bio: row.bio,
      photo_url: row.photo_url,
      talk_title: row.talk_title,
      session_type: row.session_type || 'Keynote',
      stage_room: row.stage_room,
      session_time: row.session_time,
      registration_id: row.registration_id,
      featured: row.featured ?? true,
      sort_order: row.sort_order ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pass_code: row.registrations?.registration_id || null,
      badge_token: row.registrations?.badge_token || null,
    }))

    // Cache to local as backup
    saveLocalSpeakers(eventId, list)
    return list
  } catch {
    return getLocalSpeakers(eventId)
  }
}

export async function saveSpeaker(
  eventId: string,
  speakerData: Partial<Speaker>,
  createPass = false
): Promise<Speaker> {
  let linkedRegId = speakerData.registration_id || null
  let passCode = speakerData.pass_code || null
  let badgeToken = speakerData.badge_token || null

  // If requested and not already linked, automatically create an attendee registration pass
  if (createPass && !linkedRegId && speakerData.full_name) {
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let regId = ''
      for (let i = 0; i < 6; i++) {
        regId += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      const { data: reg, error: regError } = await supabase
        .from('registrations')
        .insert({
          event_id: eventId,
          registration_id: regId,
          source: 'manual',
          full_name: speakerData.full_name.trim(),
          email: speakerData.email?.trim() || null,
          company: speakerData.company?.trim() || null,
          designation: `${speakerData.designation ? speakerData.designation + ' • ' : ''}Speaker`,
          registration_status: 'approved',
        })
        .select('id, registration_id, badge_token')
        .single()

      if (!regError && reg) {
        linkedRegId = reg.id
        passCode = reg.registration_id
        badgeToken = reg.badge_token
      }
    } catch {
      // Pass creation optional; proceed with speaker save
    }
  }

  const payload = {
    event_id: eventId,
    full_name: speakerData.full_name?.trim() || 'Speaker',
    email: speakerData.email?.trim() || null,
    phone: speakerData.phone?.trim() || null,
    company: speakerData.company?.trim() || null,
    designation: speakerData.designation?.trim() || null,
    bio: speakerData.bio?.trim() || null,
    photo_url: speakerData.photo_url || null,
    talk_title: speakerData.talk_title?.trim() || null,
    session_type: speakerData.session_type || 'Keynote',
    stage_room: speakerData.stage_room?.trim() || null,
    session_time: speakerData.session_time?.trim() || null,
    registration_id: linkedRegId,
    featured: speakerData.featured !== false,
    updated_at: new Date().toISOString(),
  }

  try {
    if (speakerData.id) {
      // Update
      const { data, error } = await supabase
        .from('event_speakers')
        .update(payload)
        .eq('id', speakerData.id)
        .select()
        .single()

      if (!error && data) {
        const updated: Speaker = {
          ...data,
          pass_code: passCode,
          badge_token: badgeToken,
        }
        const locals = getLocalSpeakers(eventId).map((s) => (s.id === updated.id ? updated : s))
        saveLocalSpeakers(eventId, locals)
        return updated
      }
    } else {
      // Insert
      const { data, error } = await supabase
        .from('event_speakers')
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        const created: Speaker = {
          ...data,
          pass_code: passCode,
          badge_token: badgeToken,
        }
        const locals = [...getLocalSpeakers(eventId), created]
        saveLocalSpeakers(eventId, locals)
        return created
      }
    }
  } catch {
    // Fall back to local storage
  }

  // Local fallback
  const fallbackId = speakerData.id || `local_spk_${Date.now()}`
  const speaker: Speaker = {
    id: fallbackId,
    event_id: eventId,
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    company: payload.company,
    designation: payload.designation,
    bio: payload.bio,
    photo_url: payload.photo_url,
    talk_title: payload.talk_title,
    session_type: payload.session_type,
    stage_room: payload.stage_room,
    session_time: payload.session_time,
    registration_id: linkedRegId,
    featured: payload.featured,
    sort_order: 0,
    created_at: speakerData.created_at || new Date().toISOString(),
    updated_at: payload.updated_at,
    pass_code: passCode || (createPass ? 'SPK-' + fallbackId.slice(-4) : null),
    badge_token: badgeToken,
  }

  const current = getLocalSpeakers(eventId)
  const exists = current.some((s) => s.id === speaker.id)
  const updated = exists ? current.map((s) => (s.id === speaker.id ? speaker : s)) : [...current, speaker]
  saveLocalSpeakers(eventId, updated)
  return speaker
}

export async function deleteSpeaker(eventId: string, speakerId: string): Promise<boolean> {
  try {
    await supabase.from('event_speakers').delete().eq('id', speakerId)
  } catch {
    // Ignore
  }
  const current = getLocalSpeakers(eventId).filter((s) => s.id !== speakerId)
  saveLocalSpeakers(eventId, current)
  return true
}
