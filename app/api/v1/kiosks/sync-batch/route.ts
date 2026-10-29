import { NextRequest, NextResponse } from 'next/server'
import { supabase, bearer, rateLimited, tooMany, rpcError } from '@/lib/kiosk/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { scans: [{ scan_id, registration_uuid, scanned_at, method }] } -> { results: [...] }
// Safe to retry: the database de-duplicates by scan_id, and checks each guest in under a lock.
export async function POST(req: NextRequest) {
  if (rateLimited(req)) return tooMany()
  const token = bearer(req)
  if (!token) return NextResponse.json({ error: 'revoked' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { scans?: unknown }
  if (!Array.isArray(body.scans) || body.scans.length === 0 || body.scans.length > 200) {
    return NextResponse.json({ error: 'Invalid batch' }, { status: 400 })
  }
  const scans = []
  for (const s of body.scans as Record<string, unknown>[]) {
    if (typeof s?.scan_id !== 'string' || !UUID.test(s.scan_id) || typeof s.registration_uuid !== 'string' || !UUID.test(s.registration_uuid)) {
      return NextResponse.json({ error: 'Invalid scan' }, { status: 400 })
    }
    const at = typeof s.scanned_at === 'string' && !Number.isNaN(Date.parse(s.scanned_at)) ? s.scanned_at : new Date().toISOString()
    scans.push({ scan_id: s.scan_id, registration_uuid: s.registration_uuid, scanned_at: at, method: s.method === 'qr' ? 'qr' : 'manual' })
  }

  const { data, error } = await supabase.rpc('kiosk_sync_batch', { p_token: token, p_scans: scans })
  if (error) return rpcError(error.message)
  return NextResponse.json({ results: data })
}
