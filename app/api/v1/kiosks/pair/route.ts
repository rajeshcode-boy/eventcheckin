import { NextRequest, NextResponse } from 'next/server'
import { supabase, rateLimited, tooMany, rpcError } from '@/lib/kiosk/server'

// POST { code } -> { kioskCode, label, token, eventName }. The code is single-use and expires after 10 minutes.
export async function POST(req: NextRequest) {
  if (rateLimited(req, 5)) return tooMany()
  const body = (await req.json().catch(() => ({}))) as { code?: unknown }
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '').slice(0, 6) : ''
  if (code.length !== 6) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 })

  const { data, error } = await supabase.rpc('kiosk_pair', { p_code: code })
  if (error) return rpcError(error.message)
  const row = data?.[0]
  if (!row) return rpcError(undefined)
  return NextResponse.json({ kioskCode: row.kiosk_code, label: row.label, token: row.token, eventName: row.event_name })
}
