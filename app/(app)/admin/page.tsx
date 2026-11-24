'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { writeImpersonation } from '@/lib/admin/impersonation'
import { parsePlanTier, PlanTier } from '@/lib/plans'
import {
  Building2,
  KeyRound,
  Copy,
  Check,
  Sparkles,
  Users,
  ShieldCheck,
  Plus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

interface Org {
  id: string
  name: string
  created_at: string
  member_count: number
  event_count: number
  plan_tier?: string
  max_attendees_override?: number | null
  max_events_override?: number | null
}

interface Member {
  id: string
  full_name: string
  email: string
  role: string
  is_owner: boolean
}

interface LicenseKeyRow {
  id: string
  key: string
  target_tier: string
  duration_days: number | null
  is_used: boolean
  used_at: string | null
  used_by_org_name: string | null
  notes: string | null
  created_at: string
}

export default function MasterAdminPage() {
  const [access, setAccess] = useState<'loading' | 'denied' | 'granted'>('loading')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [keys, setKeys] = useState<LicenseKeyRow[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [openOrgId, setOpenOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [membersLoading, setMembersLoading] = useState<string | null>(null)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [updatingOrgId, setUpdatingOrgId] = useState<string | null>(null)

  // New key generator form state
  const [keyTier, setKeyTier] = useState<PlanTier>('pro')
  const [keyNotes, setKeyNotes] = useState('')
  const [generatingKey, setGeneratingKey] = useState(false)

  const router = useRouter()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_master_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_master_admin) {
      setAccess('denied')
      return
    }
    setAccess('granted')

    // Fetch orgs & license keys in parallel
    const [{ data: orgsData, error: orgsError }, { data: keysData, error: keysError }] = await Promise.all([
      supabase.rpc('admin_list_organizations'),
      supabase.rpc('admin_list_license_keys'),
    ])

    if (orgsError) {
      setError(orgsError.message)
    } else {
      setOrgs((orgsData ?? []) as Org[])
    }

    if (!keysError && keysData) {
      setKeys(keysData as LicenseKeyRow[])
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const switchTier = async (orgId: string, newTier: PlanTier) => {
    setUpdatingOrgId(orgId)
    try {
      const { data, error } = await supabase.rpc('admin_set_organization_plan', {
        p_org_id: orgId,
        p_tier: newTier,
      })
      if (error) {
        toast.error('Failed to change tier: ' + error.message)
        return
      }
      toast.success(`Organization switched to ${newTier.toUpperCase()} successfully!`)
      setOrgs((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, plan_tier: newTier } : o))
      )
    } finally {
      setUpdatingOrgId(null)
    }
  }

  const generateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneratingKey(true)
    try {
      const { data, error } = await supabase.rpc('admin_generate_license_key', {
        p_tier: keyTier,
        p_notes: keyNotes.trim() || null,
        p_duration_days: 365,
      })
      if (error) {
        toast.error('Failed to generate key: ' + error.message)
        return
      }
      toast.success(`Generated license key: ${data?.key}`)
      setKeyNotes('')
      // Refresh keys
      const { data: updatedKeys } = await supabase.rpc('admin_list_license_keys')
      if (updatedKeys) setKeys(updatedKeys as LicenseKeyRow[])
    } finally {
      setGeneratingKey(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    toast.success('License key copied to clipboard!')
    setTimeout(() => setCopiedKey(null), 2500)
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

  if (access === 'loading') return <p className="text-muted-foreground p-6">Loading master admin studio...</p>
  if (access === 'denied') return <Alert variant="error" className="m-6">This page is for the master admin account only.</Alert>

  const filteredOrgs = orgs.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Master Admin</h1>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Superuser
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage commercial plan tiers, generate PayPal license keys, and impersonate accounts for customer support.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <Tabs defaultValue="organizations" className="w-full">
        <TabsList className="mb-5 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 size={15} /> Organizations & Tiers ({orgs.length})
          </TabsTrigger>
          <TabsTrigger value="licenses" className="flex items-center gap-2">
            <KeyRound size={15} /> PayPal License Keys ({keys.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Organizations & Tier Management */}
        <TabsContent value="organizations">
          <Input
            placeholder="Search organisations by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-4 h-10"
          />

          <div className="flex flex-col gap-3">
            {filteredOrgs.map((org) => {
              const currentTier = parsePlanTier(org.plan_tier)
              return (
                <Card key={org.id} className="overflow-hidden">
                  <CardHeader className="py-3.5 px-4 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => toggleOrg(org.id)}
                        className="flex items-center gap-2.5 text-left font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <Building2 size={18} className="text-muted-foreground shrink-0" />
                        <span>{org.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          ({org.member_count} member{org.member_count === 1 ? '' : 's'} • {org.event_count} event{org.event_count === 1 ? '' : 's'})
                        </span>
                        <span aria-hidden="true" className="text-muted-foreground ml-1">{openOrgId === org.id ? '−' : '+'}</span>
                      </button>

                      {/* Tier Switcher Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">Tier:</span>
                        <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
                          {(['starter', 'pro', 'enterprise'] as PlanTier[]).map((t) => (
                            <button
                              key={t}
                              type="button"
                              disabled={updatingOrgId === org.id}
                              onClick={() => switchTier(org.id, t)}
                              className={`px-2.5 py-1 text-xs font-medium rounded transition-all capitalize ${
                                currentTier === t
                                  ? t === 'pro'
                                    ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                                    : t === 'enterprise'
                                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                                    : 'bg-background text-foreground shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {openOrgId === org.id && (
                    <CardContent className="border-t border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Organization Members
                        </p>
                        <span className="text-xs text-muted-foreground">ID: {org.id}</span>
                      </div>
                      {membersLoading === org.id && <p className="text-sm text-muted-foreground">Loading members...</p>}
                      {members[org.id]?.length === 0 && <p className="text-sm text-muted-foreground">No members.</p>}
                      <div className="flex flex-col gap-2">
                        {members[org.id]?.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-background p-2.5"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {member.full_name || 'Unnamed member'}
                                {member.is_owner && (
                                  <Badge variant="outline" className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                                    Owner
                                  </Badge>
                                )}
                                {!member.is_owner && member.role === 'admin' && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">
                                    Admin
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => logInAs(member)}
                              disabled={startingId === member.id}
                              className="text-xs"
                            >
                              {startingId === member.id ? 'Starting...' : 'Log in as'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
            {filteredOrgs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No organisations match "{query}".</p>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: PayPal License Keys */}
        <TabsContent value="licenses">
          {/* Key Generator Card */}
          <Card className="mb-6">
            <CardHeader className="py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles size={16} className="text-primary" /> Generate License Key (For PayPal Customer)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={generateKey} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="w-full sm:w-44">
                  <label className="mb-1 block text-xs font-semibold text-foreground">Target Tier</label>
                  <select
                    value={keyTier}
                    onChange={(e) => setKeyTier(e.target.value as PlanTier)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="pro">Pro ($49)</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold text-foreground">Customer Note / PayPal Tx #</label>
                  <Input
                    placeholder="e.g. PayPal $49 tx #4KL892 - Rajesh Kumar"
                    value={keyNotes}
                    onChange={(e) => setKeyNotes(e.target.value)}
                    className="h-10"
                  />
                </div>
                <Button type="submit" disabled={generatingKey} className="gap-2 shrink-0">
                  <Plus size={15} /> {generatingKey ? 'Generating...' : 'Create License Key'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Keys Table */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span>All Generated License Keys</span>
                <span className="text-xs font-normal text-muted-foreground">{keys.length} total keys</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">License Key</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes / PayPal Ref</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-foreground">
                          {k.key}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize text-xs font-semibold">
                            {k.target_tier}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {k.is_used ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <span className="size-2 rounded-full bg-slate-400" /> Redeemed
                              </span>
                              {k.used_by_org_name && (
                                <span className="text-[11px] text-muted-foreground">by {k.used_by_org_name}</span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                              <span className="size-2 rounded-full bg-emerald-500" /> Active & Ready
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                          {k.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(k.key)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            {copiedKey === k.key ? (
                              <>
                                <Check size={13} className="text-emerald-600" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={13} /> Copy Key
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {keys.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No license keys generated yet. Click "Create License Key" above to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
