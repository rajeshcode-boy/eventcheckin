import { NextRequest, NextResponse } from 'next/server'
import { supabase, bearer, rateLimited, tooMany, rpcError } from '@/lib/kiosk/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { scan_id } -> { undone }. A kiosk can only undo a check-in it made itself.
export async function POST(req: NextRequest) {
  if (rateLimited(req)) return tooMany()
  const token = bearer(req)
  if (!token) return NextResponse.json({ error: 'revoked' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { scan_id?: unknown }
  if (typeof body.scan_id !== 'string' || !UUID.test(body.scan_id)) {
    return NextResponse.json({ error: 'Invalid scan' }, { status: 400 })
  }
  const { data, error } = await supabase.rpc('kiosk_undo', { p_token: token, p_scan_id: body.scan_id })
  if (error) return rpcError(error.message)
  return NextResponse.json({ undone: data === true })
}
