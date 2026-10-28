import { NextRequest, NextResponse } from 'next/server'
import { supabase, bearer, rateLimited, tooMany, rpcError } from '@/lib/kiosk/server'

// GET (Authorization: Bearer <kiosk token>) -> guest list and current check-in state for the offline cache.
export async function GET(req: NextRequest) {
  if (rateLimited(req)) return tooMany()
  const token = bearer(req)
  if (!token) return NextResponse.json({ error: 'revoked' }, { status: 401 })
  const { data, error } = await supabase.rpc('kiosk_roster', { p_token: token })
  if (error) return rpcError(error.message)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
