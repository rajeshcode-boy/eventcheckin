import { supabase } from '@/lib/supabase'
import { isEventRole, type EventRole } from '@/lib/permissions'

// The signed-in user's role on one event, from get_user_event_role() (SQL/020).
// Returns null when they have no access to the event.
export async function fetchEventRole(eventId: string): Promise<EventRole | null> {
  const { data, error } = await supabase.rpc('get_user_event_role', { p_event_id: eventId })
  if (!error) return isEventRole(data) ? data : null

  // The function is missing until SQL/020 has been applied. Until then, fall back to the old
  // organisation roles so the app keeps working: admins manage, everyone else is onsite staff.
  if (error.code === 'PGRST202' || /get_user_event_role/.test(error.message)) {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null
    const { data: profile } = await supabase.from('profiles').select('role, is_owner').eq('id', auth.user.id).single()
    if (!profile) return null
    return profile.is_owner ? 'owner' : profile.role === 'admin' ? 'manager' : 'staff'
  }
  throw error
}
