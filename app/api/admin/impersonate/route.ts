import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireMasterAdmin } from '@/lib/admin/server'

function bearerToken(req: NextRequest): string | null {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
}

// POST { targetProfileId } -> { tokenHash, email, logId }. Starts an impersonation session:
// generates a one-time sign-in token for the target user and logs who, who-as and when.
export async function POST(req: NextRequest) {
  const masterAdminId = await requireMasterAdmin(bearerToken(req))
  if (!masterAdminId) return NextResponse.json({ error: 'Master admin only' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { targetProfileId?: unknown; reason?: unknown }
  const targetProfileId = typeof body.targetProfileId === 'string' ? body.targetProfileId : ''
  if (!targetProfileId) return NextResponse.json({ error: 'Missing targetProfileId' }, { status: 400 })

  const admin = adminClient()
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, email, organization_id, full_name')
    .eq('id', targetProfileId)
    .single()
  if (targetError || !target?.email) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Could not start a session for that user' }, { status: 502 })
  }

  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null
  const { data: logRow, error: logError } = await admin
    .from('impersonation_log')
    .insert({
      master_admin_id: masterAdminId,
      target_profile_id: target.id,
      target_organization_id: target.organization_id,
      target_email: target.email,
      reason,
    })
    .select('id')
    .single()
  if (logError || !logRow) return NextResponse.json({ error: 'Could not log the impersonation session' }, { status: 500 })

  return NextResponse.json({
    tokenHash: linkData.properties.hashed_token,
    email: target.email,
    name: target.full_name,
    logId: logRow.id,
  })
}

// PATCH { logId } -> marks an impersonation session as ended (for the audit trail).
export async function PATCH(req: NextRequest) {
  const masterAdminId = await requireMasterAdmin(bearerToken(req))
  if (!masterAdminId) return NextResponse.json({ error: 'Master admin only' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { logId?: unknown }
  const logId = typeof body.logId === 'string' ? body.logId : ''
  if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 })

  const admin = adminClient()
  await admin
    .from('impersonation_log')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', logId)
    .eq('master_admin_id', masterAdminId)
    .is('ended_at', null)

  return NextResponse.json({ ok: true })
}
