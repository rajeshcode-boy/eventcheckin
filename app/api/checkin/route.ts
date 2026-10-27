import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushSafely } from '@/lib/push/server'

// Public check-in API used by /checkin/[eventId] (no login).
// Calls the SECURITY DEFINER functions from SQL/005 with the anon key.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// 10 requests per second per IP. In-memory, so per server instance.
const RATE_LIMIT = 10
const WINDOW_MS = 1000
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key)
  }
  return recent.length > RATE_LIMIT
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

export async function GET(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }
  const eventId = str(req.nextUrl.searchParams.get('eventId'), 100)
  const { data, error } = await supabase.rpc('public_event_info', { p_event_id: eventId })
  if (error) return NextResponse.json({ error: 'Could not load event' }, { status: 502 })
  const event = data?.[0]
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json({ event })
}

export async function POST(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const eventId = str(body.eventId, 100)

  if (body.walkin && typeof body.walkin === 'object') {
    const w = body.walkin as Record<string, unknown>
    const { data, error } = await supabase.rpc('public_register_walkin', {
      p_event_id: eventId,
      p_first_name: str(w.firstName),
      p_last_name: str(w.lastName),
      p_designation: str(w.designation),
      p_company: str(w.company),
      p_email: str(w.email),
    })
    if (error) return NextResponse.json({ error: 'Could not register walk-in' }, { status: 502 })
    return NextResponse.json({ result: data?.[0] })
  }

  const query = str(body.query)
  if (!query.trim()) return NextResponse.json({ error: 'Enter your email or phone' }, { status: 400 })
  const { data, error } = await supabase.rpc('public_check_in_guest', { p_event_id: eventId, p_query: query })
  if (error) return NextResponse.json({ error: 'Check-in failed' }, { status: 502 })
  const result = data?.[0]
  // Tell the guest on their devices that they are in (only if they subscribed from their badge page)
  if (result?.status === 'checked_in' && result.badge_token) {
    await sendPushSafely(
      { column: 'badge_token', value: result.badge_token },
      { title: "You're checked in", body: `Welcome, ${result.full_name}. Your badge is ready.`, url: `/badge/${result.badge_token}`, tag: 'checkin' }
    )
  }
  return NextResponse.json({ result })
}
