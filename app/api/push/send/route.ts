import { NextRequest, NextResponse } from 'next/server'
import { sendPush, userIdFromToken } from '@/lib/push/server'

// Sends a notification to the signed-in organiser's own devices (used by "Send a test notification").
// Requires the Supabase access token: Authorization: Bearer <token>.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const userId = await userIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const title = typeof body.title === 'string' ? body.title.slice(0, 80) : ''
  const message = typeof body.body === 'string' ? body.body.slice(0, 200) : ''
  if (!title.trim()) return NextResponse.json({ error: 'Add a title' }, { status: 400 })

  try {
    const result = await sendPush({ column: 'user_id', value: userId }, { title, body: message, url: '/profile' })
    if (!result.configured) return NextResponse.json({ error: 'Notifications are not set up yet' }, { status: 503 })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Could not send notifications' }, { status: 502 })
  }
}
