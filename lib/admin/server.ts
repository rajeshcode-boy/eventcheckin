import { createClient } from '@supabase/supabase-js'

// Server-only: master admin impersonation. Uses the service role key, so never import this from a client component.

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Verifies the bearer token belongs to a signed-in master admin. Returns their user id, or null.
export async function requireMasterAdmin(accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null
  const admin = adminClient()
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData.user) return null

  const { data: profile } = await admin.from('profiles').select('is_master_admin').eq('id', userData.user.id).single()
  if (!profile?.is_master_admin) return null

  return userData.user.id
}
