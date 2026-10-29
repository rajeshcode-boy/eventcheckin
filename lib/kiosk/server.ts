// Server-only helpers for /api/v1/kiosks/*. Uses the anon key and the SECURITY DEFINER functions
// from SQL/015; the kiosk token is what authorises each call, never the service role key.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// In-memory per instance, like app/api/checkin (known weak; the pairing code also has a DB-side throttle).
const hits = new Map<string, number[]>()
export function rateLimited(req: NextRequest, limit = 20, windowMs = 1000): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(key)
  }
  return recent.length > limit
}

export function bearer(req: NextRequest): string {
  const h = req.headers.get('authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7).trim().slice(0, 200) : ''
}

export const tooMany = () => NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

// Maps the database's named errors to HTTP responses without leaking anything else.
export function rpcError(message: string | undefined): NextResponse {
  if (message?.includes('invalid_kiosk')) return NextResponse.json({ error: 'revoked' }, { status: 401 })
  if (message?.includes('invalid_code')) return NextResponse.json({ error: 'That code is wrong or has expired.' }, { status: 400 })
  if (message?.includes('too_many_attempts')) return NextResponse.json({ error: 'Too many wrong codes. Wait a minute.' }, { status: 429 })
  if (message?.includes('invalid_batch')) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
  return NextResponse.json({ error: 'Server error' }, { status: 502 })
}
