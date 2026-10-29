'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { writeImpersonation } from '@/lib/admin/impersonation'

interface Org {
  id: string
  name: string
  created_at: string
  member_count: number
  event_count: number
}

interface Member {
  id: string
  full_name: string
  email: string
  role: string
  is_owner: boolean
}

// Master-admin-only support tool: every organisation, and a "Log in as" button for each of
// its members, so an issue can be reproduced and fixed from inside their own account.
export default function MasterAdminPage() {
  const [access, setAccess] = useState<'loading' | 'denied' | 'granted'>('loading')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [openOrgId, setOpenOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [membersLoading, setMembersLoading] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('is_master_admin').eq('id', user.id).single()
      if (!profile?.is_master_admin) {
        setAccess('denied')
        return
      }
      setAccess('granted')

      const { data, error: orgsError } = await supabase.rpc('admin_list_organizations')
      if (orgsError) {
        setError(orgsError.message)
        return
      }
      setOrgs((data ?? []) as Org[])
    }
    load()
  }, [router])

  const toggleOrg = async (orgId: string) => {
    if (openOrgId === orgId) {
      setOpenOrgId(null)
      return
    }
    setOpenOrgId(orgId)
    if (members[orgId]) return
    setMembersLoading(orgId)
    const { data, error: membersError } = await supabase.rpc('admin_list_org_members', { p_org_id: orgId })
    setMembersLoading(null)
    if (membersError) {
      toast.error(membersError.message)
      return
    }
    setMembers((prev) => ({ ...prev, [orgId]: (data ?? []) as Member[] }))
  }

  const logInAs = async (member: Member) => {
    setStartingId(member.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Your session expired. Sign in again.')
        return
      }

      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ targetProfileId: member.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'Could not start that session')
        return
      }

      writeImpersonation({
        logId: body.logId,
        targetEmail: body.email,
        targetName: body.name ?? '',
        returnAccessToken: session.access_token,
        returnRefreshToken: session.refresh_token,
      })

      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: body.tokenHash, type: 'magiclink' })
      if (verifyError) {
        toast.error('Could not sign in as that user')
        return
      }

      router.push('/events')
    } finally {
      setStartingId(null)
    }
  }

  if (access === 'loading') return <p className="text-muted-foreground">Loading...</p>
  if (access === 'denied') return <Alert variant="error">This page is for the master admin account only.</Alert>

  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="max-w-[760px]">
      <h1 className="mb-1 text-[28px] font-bold">Master admin</h1>
      <p className="mb-5 text-muted-foreground">
        Every organisation on EventCheckin. Open one and use "Log in as" to see the app exactly as that
        person does, so you can reproduce and fix an issue for them. Each session is logged.
      </p>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <Input
        placeholder="Search organisations..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 h-10"
      />

      <div className="flex flex-col gap-3">
        {filtered.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <CardTitle>
                <button type="button" onClick={() => toggleOrg(org.id)} className="flex w-full items-center justify-between text-left">
                  <span>
                    {org.name}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {org.member_count} member{org.member_count === 1 ? '' : 's'} • {org.event_count} event{org.event_count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">{openOrgId === org.id ? '−' : '+'}</span>
                </button>
              </CardTitle>
            </CardHeader>
            {openOrgId === org.id && (
              <CardContent>
                {membersLoading === org.id && <p className="text-sm text-muted-foreground">Loading members...</p>}
                {members[org.id]?.length === 0 && <p className="text-sm text-muted-foreground">No members.</p>}
                <div className="flex flex-col gap-2">
                  {members[org.id]?.map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {member.full_name}
                          {member.is_owner && <span className="ml-2 text-xs font-normal text-muted-foreground">Owner</span>}
                          {!member.is_owner && member.role === 'admin' && <span className="ml-2 text-xs font-normal text-muted-foreground">Admin</span>}
                        </p>
                        <p className="text-[13px] text-muted-foreground">{member.email}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => logInAs(member)} disabled={startingId === member.id}>
                        {startingId === member.id ? 'Starting...' : 'Log in as'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No organisations match "{query}".</p>}
      </div>
    </div>
  )
}
