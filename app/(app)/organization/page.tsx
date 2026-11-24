'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { LOGO_RULES } from '@/lib/images'
import ImageUpload from '@/components/ImageUpload'
import UpgradeModal from '@/components/UpgradeModal'
import { getPlanConfig, parsePlanTier, PlanTier } from '@/lib/plans'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CustomSelect } from '@/components/ui/custom-select'
import { cn } from '@/lib/utils'
import {
  Building2, Calendar, CalendarDays, ShieldAlert, Sparkles, AlertTriangle,
  Users, UserPlus, Mail, Shield, Check, Copy, ExternalLink, Trash2, Clock,
  KeyRound, Zap, ShieldCheck
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  logo_path: string | null
  created_at: string
  plan_tier?: string
  max_attendees_override?: number | null
  max_events_override?: number | null
}

interface Member {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'staff'
  is_owner?: boolean
  created_at: string
}

interface TeamInvite {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'staff'
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  created_at: string
}

export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [eventCount, setEventCount] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  // Invite modal / state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff')
  const [inviting, setInviting] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Plan & Upgrade state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeNotice, setUpgradeNotice] = useState('')
  const [quickKey, setQuickKey] = useState('')
  const [redeemingQuickKey, setRedeemingQuickKey] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()
    if (!profile) {
      setError('Your profile could not be loaded.')
      return
    }
    setIsAdmin(profile.role === 'admin')

    const [{ data: orgData }, { count }, { data: membersData }, { data: invitesData }] = await Promise.all([
      supabase.from('organizations').select('id, name, logo_path, created_at, plan_tier, max_attendees_override, max_events_override').eq('id', profile.organization_id).single(),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      supabase.from('profiles').select('id, full_name, email, role, is_owner, created_at').eq('organization_id', profile.organization_id).order('created_at'),
      supabase.from('team_invites').select('id, email, full_name, role, status, created_at').eq('organization_id', profile.organization_id).eq('status', 'pending').order('created_at', { ascending: false }),
    ])

    if (!orgData) {
      setError('Your organization could not be loaded.')
      return
    }
    setOrg(orgData)
    setName(orgData.name)
    setEventCount(count ?? 0)
    setMembers((membersData ?? []) as Member[])
    setInvites((invitesData ?? []) as TeamInvite[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return
    setError('')
    setNotice('')
    if (!name.trim()) {
      setError('Organization name is required.')
      return
    }
    setSaving(true)
    const { data, error: updateError } = await supabase.from('organizations').update({ name: name.trim() }).eq('id', org.id).select('id')
    setSaving(false)
    if (updateError || !data?.length) {
      setError('Could not save. Only admins can edit the organization.')
      return
    }
    setOrg({ ...org, name: name.trim() })
    setNotice('Organization details updated successfully.')
  }

  const saveLogo = async (path: string | null) => {
    if (!org) return false
    const { data, error: updateError } = await supabase.from('organizations').update({ logo_path: path }).eq('id', org.id).select('id')
    if (updateError || !data?.length) return false
    setOrg({ ...org, logo_path: path })
    return true
  }

  const getShareableInviteLink = () => {
    if (!org || typeof window === 'undefined') return ''
    const base = window.location.origin
    const params = new URLSearchParams({
      org: org.id,
      role: inviteRole,
    })
    if (inviteEmail.trim()) params.set('email', inviteEmail.trim())
    return `${base}/signup?${params.toString()}`
  }

  const copyInviteLink = async () => {
    const link = getShareableInviteLink()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // fallback
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !currentUserId) return
    setError('')
    setNotice('')

    if (!inviteEmail.trim()) {
      setError('Teammate email is required.')
      return
    }

    setInviting(true)
    const { error: insertError } = await supabase.from('team_invites').insert([
      {
        organization_id: org.id,
        email: inviteEmail.trim().toLowerCase(),
        full_name: inviteName.trim() || null,
        role: inviteRole,
        invited_by: currentUserId,
        status: 'pending',
      },
    ])
    setInviting(false)

    if (insertError) {
      if (insertError.message.includes('unique') || insertError.code === '23505') {
        setError('An invite has already been sent to this email address.')
      } else {
        setError('Could not send invite: ' + insertError.message)
      }
      return
    }

    setNotice(`Invite created for ${inviteEmail.trim()}. Share the invite link with them to join.`)
    setInviteEmail('')
    setInviteName('')
    setShowInviteModal(false)
    load()
  }

  const handleQuickRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = quickKey.trim().toUpperCase()
    if (!cleanKey) return
    setRedeemingQuickKey(true)
    setError('')
    setNotice('')
    try {
      const { data, error } = await supabase.rpc('redeem_license_key', { p_key: cleanKey })
      if (error) {
        setError('License redemption failed: ' + error.message)
        return
      }
      if (!data?.success) {
        setError(data?.message || 'Invalid license key.')
        return
      }
      setNotice(data.message || 'License redeemed successfully!')
      setQuickKey('')
      load()
    } finally {
      setRedeemingQuickKey(false)
    }
  }

  const revokeInvite = async (inviteId: string) => {
    if (!org) return
    const { error: revokeError } = await supabase
      .from('team_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)

    if (revokeError) {
      setError('Could not revoke invite: ' + revokeError.message)
    } else {
      setNotice('Invite revoked.')
      load()
    }
  }

  if (!org) return error ? <Alert variant="error">{error}</Alert> : <div className="p-8 text-center text-muted-foreground">Loading organization...</div>

  const formattedDate = new Date(org.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const planTier = parsePlanTier(org.plan_tier)
  const planConfig = getPlanConfig(planTier)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-16">
      {/* Header with Title & Meta Badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={22} className="text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Organization Profile</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your company details, brand logo assets, commercial plan, and team member permissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={planTier === 'pro' ? 'default' : 'secondary'}
            className={cn(
              'px-3 py-1 text-xs font-semibold capitalize',
              planTier === 'pro' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
            )}
          >
            <Zap size={13} className="mr-1.5" />
            {planConfig.name}
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
            <CalendarDays size={13} className="mr-1.5 text-primary" />
            {eventCount} {eventCount === 1 ? 'Event' : 'Events'} Active
          </Badge>
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
            <Users size={13} className="mr-1.5 text-primary" />
            {members.length} {members.length === 1 ? 'Team Member' : 'Team Members'}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 text-xs font-medium text-muted-foreground">
            Member since {formattedDate}
          </Badge>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {!isAdmin && (
        <Alert variant="warning">
          You are viewing this organization as staff. Only organization administrators can modify these details.
        </Alert>
      )}

      {/* PLAN & COMMERCIALS CARD */}
      <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">Current Plan: {planConfig.name}</h2>
              <Badge variant={planConfig.badgeTone === 'primary' ? 'default' : 'secondary'} className="capitalize text-xs">
                {planConfig.tier}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {planConfig.tagline}
            </p>
          </div>

          {planTier === 'starter' ? (
            <Button
              type="button"
              onClick={() => {
                setUpgradeNotice('Upgrade to Pro to unlock 1,000 attendees, 10 events, and Badge Studio.')
                setShowUpgradeModal(true)
              }}
              className="rounded-full bg-primary font-semibold gap-2 shadow-sm text-primary-foreground"
            >
              <Sparkles size={16} /> Upgrade to Pro ($49)
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <ShieldCheck size={16} /> Commercial License Active
            </div>
          )}
        </div>

        {/* Live Quota Usage Meters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5">
          <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">Active Events Quota</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-foreground">{eventCount}</span>
              <span className="text-xs text-muted-foreground">of {planConfig.maxActiveEvents} allowed</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, (eventCount / planConfig.maxActiveEvents) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">Team Member Seats</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-foreground">{members.length}</span>
              <span className="text-xs text-muted-foreground">of {planConfig.maxTeamSeats} seats</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, (members.length / planConfig.maxTeamSeats) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-muted/30 p-4">
            <span className="text-xs font-medium text-muted-foreground">Max Guests per Event</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-foreground">
                {org.max_attendees_override || planConfig.maxAttendeesPerEvent}
              </span>
              <span className="text-xs text-muted-foreground">attendees cap</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-2 block">
              {planTier === 'starter' ? 'Expandable to 1,000 on Pro' : 'High capacity enabled'}
            </span>
          </div>
        </div>

        {/* License Key Quick Redemption */}
        {isAdmin && (
          <div className="mt-2 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <KeyRound size={15} className="text-primary shrink-0" />
              <span className="font-medium text-foreground">Have a PayPal license code or activation key?</span>
            </div>
            <form onSubmit={handleQuickRedeem} className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="PRO-XXXX-XXXX-XXXX"
                value={quickKey}
                onChange={(e) => setQuickKey(e.target.value.toUpperCase())}
                className="h-8 text-xs font-mono uppercase w-full sm:w-52"
              />
              <Button type="submit" size="sm" variant="outline" disabled={redeemingQuickKey} className="h-8 text-xs shrink-0">
                {redeemingQuickKey ? 'Redeeming...' : 'Redeem Key'}
              </Button>
            </form>
          </div>
        )}
      </Card>

      {/* Grid: Assets & Company Details */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left Column: Company Logo & Brand Asset Card */}
        <div className="space-y-6 md:col-span-1">
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Company Brand Logo
              </h2>
            </div>
            <div className="flex flex-col items-center text-center">
              <ImageUpload
                mode="saved"
                label="Company logo"
                shape="logo"
                rules={LOGO_RULES}
                bucket="branding"
                folder={`${org.id}/organization`}
                kind="logo"
                path={org.logo_path}
                onSave={saveLogo}
                disabled={!isAdmin}
                hint="Used as default header logo across your badges, attendee pass emails, and kiosks."
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Name & General Details */}
        <div className="space-y-6 md:col-span-2">
          <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-foreground mb-1">Company Details</h2>
            <p className="text-xs text-muted-foreground mb-6">
              This name is shown to guests and badge holders across all events.
            </p>

            <form onSubmit={saveName} className="space-y-5">
              <div>
                <label htmlFor="org-name" className="mb-2 block font-medium text-sm text-foreground">
                  Organization Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="org-name"
                  className="h-11 rounded-xl text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  disabled={!isAdmin}
                  placeholder="e.g. Acme Conferences Inc."
                />
              </div>

              {isAdmin && (
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="rounded-full bg-primary font-semibold text-primary-foreground shadow-xs"
                    disabled={saving || name.trim() === org.name}
                  >
                    {saving ? 'Saving changes...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>

      {/* TEAM MEMBERS & INVITES SECTION (New Master Section) */}
      <div id="team" className="space-y-6">
        <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <Users size={20} className="text-primary" />
                <h2 className="text-xl font-bold text-foreground">Organization Team Members</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                People who can log in to your organization. They can then be assigned to run check-in gates and badge printing at events.
              </p>
            </div>

            {isAdmin && (
              <Button
                type="button"
                onClick={() => {
                  if (members.length >= planConfig.maxTeamSeats) {
                    setUpgradeNotice(
                      `Your ${planConfig.name} allows up to ${planConfig.maxTeamSeats} team member seat. Upgrade to Pro for up to 5 seats!`
                    )
                    setShowUpgradeModal(true)
                    return
                  }
                  setShowInviteModal(true)
                }}
                className="rounded-full bg-primary text-primary-foreground font-semibold gap-1.5 shadow-xs"
              >
                <UserPlus size={16} />
                + Invite Teammate
              </Button>
            )}
          </div>

          {/* Members List */}
          <div className="divide-y divide-border">
            {members.map((m) => {
              const isOwner = m.is_owner
              const isCurrent = m.id === currentUserId
              const memberDate = m.created_at
                ? new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Joined'

              return (
                <div key={m.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {m.full_name ? m.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {m.full_name || 'Unnamed Member'}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate block">
                        {m.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {memberDate}
                    </span>
                    <Badge
                      variant={isOwner ? 'default' : m.role === 'admin' ? 'secondary' : 'outline'}
                      className={cn(
                        'text-xs font-semibold capitalize',
                        isOwner ? 'bg-purple-600 text-white hover:bg-purple-700' : m.role === 'admin' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : ''
                      )}
                    >
                      {isOwner ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Staff'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pending Invites List */}
          {invites.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Clock size={14} /> Pending Invitations ({invites.length})
              </h3>
              <div className="divide-y divide-border/60">
                {invites.map((inv) => (
                  <div key={inv.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 flex items-center justify-center text-xs flex-shrink-0">
                        <Mail size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-foreground truncate">{inv.email}</span>
                          {inv.full_name && <span className="text-xs text-muted-foreground">({inv.full_name})</span>}
                        </div>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          Awaiting registration as {inv.role === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10 border-destructive/20"
                        onClick={() => revokeInvite(inv.id)}
                      >
                        <Trash2 size={12} /> Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-2 text-destructive">
          <AlertTriangle size={20} />
          <h2 className="text-base font-bold">Danger Zone</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          Permanently delete this organization, along with all associated events, badges, check-in history, and attendee rosters.
        </p>
        <div className="flex items-center justify-between border-t border-destructive/20 pt-4">
          <span className="text-xs text-muted-foreground font-medium">
            Self-service deletion is locked to prevent accidental data loss.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-destructive/40 text-destructive opacity-60"
            disabled
          >
            Delete Organization
          </Button>
        </div>
      </Card>

      {/* INVITE TEAMMATE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Invite Teammate</h3>
                  <p className="text-xs text-muted-foreground">Add staff to your organization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label htmlFor="invite-email" className="block text-xs font-semibold text-foreground mb-1.5">
                  Email Address <span className="text-destructive">*</span>
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label htmlFor="invite-name" className="block text-xs font-semibold text-foreground mb-1.5">
                  Full Name (Optional)
                </label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Organization Role
                </label>
                <CustomSelect
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v as 'admin' | 'staff')}
                  options={[
                    { value: 'staff', label: 'Staff Member (Can run check-in & badges at events)' },
                    { value: 'admin', label: 'Organization Admin (Full event creation & settings)' },
                  ]}
                />
              </div>

              {/* Shareable Link Box */}
              <div className="p-3 bg-muted rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Shareable Signup Link:</span>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="text-primary hover:underline flex items-center gap-1 font-bold"
                  >
                    {copiedLink ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Anyone with this link will automatically join <strong>{org.name}</strong> upon creating their account.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? 'Creating Invite...' : 'Send Invite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgrade & Commercial Licensing Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgraded={() => {
          load()
        }}
        featureNotice={upgradeNotice}
      />
    </div>
  )
}
