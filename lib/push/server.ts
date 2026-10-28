import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Server-only: sends web push notifications. Uses the service role key, so never import this from a client component.

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export interface PushResult {
  sent: number
  removed: number
  configured: boolean
}

// Subscriptions belong to an organiser (user_id) or a guest (badge_token)
type Owner = { column: 'user_id'; value: string } | { column: 'badge_token'; value: string }

function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function sendPush(owner: Owner, payload: PushPayload): Promise<PushResult> {
  if (!configureVapid()) return { sent: 0, removed: 0, configured: false }

  const admin = adminClient()
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh_key, auth_key')
    .eq(owner.column, owner.value)
  if (error || !data) throw new Error('Could not load push subscriptions')
  const subscriptions = data

  const body = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh_key, auth: row.auth_key } },
        body,
        { TTL: 60 * 60 }
      )
    )
  )

  // 404 and 410 mean the browser or home-screen app removed the subscription: forget it
  const gone = results.flatMap((result, i) => {
    if (result.status !== 'rejected') return []
    const status = (result.reason as { statusCode?: number }).statusCode
    const row = subscriptions[i]
    return row && (status === 404 || status === 410) ? [row.id] : []
  })
  if (gone.length > 0) await admin.from('push_subscriptions').delete().in('id', gone)

  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    removed: gone.length,
    configured: true,
  }
}

// Sends are best effort: a failed notification must never fail the action that triggered it
export async function sendPushSafely(owner: Owner, payload: PushPayload): Promise<PushResult | null> {
  try {
    return await sendPush(owner, payload)
  } catch (err) {
    console.error('Push notification failed', err)
    return null
  }
}

export async function userIdFromToken(accessToken: string): Promise<string | null> {
  const { data, error } = await adminClient().auth.getUser(accessToken)
  if (error || !data.user) return null
  return data.user.id
}
