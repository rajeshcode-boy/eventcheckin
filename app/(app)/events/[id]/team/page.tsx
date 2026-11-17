'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEventRole } from '@/components/EventRoleContext'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { CustomSelect } from '@/components/ui/custom-select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  canAssignOwner,
  canManageTeam,
  EVENT_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type EventRole as Role,
} from '@/lib/permissions'
import { Users, UserPlus, Shield, ShieldCheck, MapPin, Trash2, CheckCircle2 } from 'lucide-react'

const ROLES: { value: Role; label: string }[] = EVENT_ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

interface Member {
  id: string
  full_name: string | null
  email?: string | null
}

interface Assignment {
  id: string
  profile_id: string
  role: Role
  on_site: boolean
  profiles: { full_name: string | null; email?: string | null } | null
}

export default function TeamPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [orgId, setOrgId] = useState<string | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const myRole = useEventRole()
  const isAdmin = canManageTeam(myRole)
  const assignable = ROLES.filter((r) => r.value !== 'owner' || canAssignOwner(myRole))
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [newProfile, setNewProfile] = useState('')
  const [newRole, setNewRole] = useState<Role>('staff')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      setMe(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()
      if (!profile) {
        setError('Your profile could not be loaded.')
        return
      }
      setOrgId(profile.organization_id)

      const [membersRes, assignRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('organization_id', profile.organization_id)
          .order('full_name'),
        supabase
          .from('event_staff_assignments')
          .select('id, profile_id, role, on_site, profiles(full_name, email)')
          .eq('event_id', eventUuid)
          .order('created_at'),
      ])
      if (membersRes.error || assignRes.error) {
        setError('Could not load the team. Try again.')
        return
      }
      setMembers((membersRes.data ?? []) as Member[])
      setAssignments((assignRes.data ?? []) as unknown as Assignment[])
      setError('')
    } finally {
      setLoading(false)
    }
  }, [eventUuid])

  useEffect(() => {
    load()
  }, [load])

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.profile_id)), [assignments])
  const unassigned = members.filter((m) => !assignedIds.has(m.id))
  const onSiteCount = assignments.filter((a) => a.on_site).length

  const addMember = async () => {
    if (!orgId || !newProfile) return
    setBusy(true)
    const { error: insertError } = await supabase.from('event_staff_assignments').insert([
      { event_id: eventUuid, organization_id: orgId, profile_id: newProfile, role: newRole },
    ])
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewProfile('')
    load()
  }

  const changeRole = async (id: string, role: Role) => {
    const { error: updateError } = await supabase
      .from('event_staff_assignments')
      .update({ role })
      .eq('id', id)
    if (updateError) setError(updateError.message)
    else load()
  }

  const toggleOnSite = async (a: Assignment) => {
    const { error: updateError } = await supabase
      .from('event_staff_assignments')
      .update({ on_site: !a.on_site })
      .eq('id', a.id)
    if (updateError) setError(updateError.message)
    else load()
  }

  const remove = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('event_staff_assignments')
      .delete()
      .eq('id', id)
    if (deleteError) setError(deleteError.message)
    else load()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading team roster...</p>

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Users size={22} className="text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Event Team & Staff</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage organizer permissions, gate check-in operators, and on-site staff attendance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
            {assignments.length} {assignments.length === 1 ? 'Member' : 'Members'} Assigned
          </Badge>
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold text-(--color-live)">
            <span className="mr-1.5 size-2 rounded-full bg-(--color-live) animate-pulse inline-block" />
            {onSiteCount} On Site Now
          </Badge>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Add Team Member & Role Guide */}
        <div className="space-y-6 lg:col-span-1">
          {isAdmin && (
            <Card className="overflow-visible rounded-3xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={18} className="text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Assign Staff Member
                </h2>
              </div>

              {members.length > 0 && unassigned.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Everyone in your organization is already assigned to this event.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Person
                    </label>
                    <CustomSelect
                      value={newProfile}
                      onChange={(v) => setNewProfile(v)}
                      placeholder="Select an organization member..."
                      options={[
                        { value: '', label: 'Select an organization member...' },
                        ...unassigned.map((m) => ({
                          value: m.id,
                          label: m.full_name || 'Unnamed member',
                        })),
                      ]}
                      aria-label="Team member"
                    />
                    <div className="flex justify-between items-center mt-1.5 px-0.5">
                      <span className="text-[11px] text-muted-foreground">Need to add staff?</span>
                      <Link href="/organization#team" className="text-[11px] font-semibold text-primary hover:underline">
                        + Invite to Organization →
                      </Link>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Event Role
                    </label>
                    <CustomSelect
                      value={newRole}
                      onChange={(v) => setNewRole(v as Role)}
                      options={assignable.map((r) => ({
                        value: r.value,
                        label: r.label,
                        dot:
                          r.value === 'owner'
                            ? 'bg-purple-500'
                            : r.value === 'manager'
                            ? 'bg-emerald-500'
                            : r.value === 'staff'
                            ? 'bg-blue-500'
                            : 'bg-amber-500',
                      }))}
                      aria-label="Role"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={addMember}
                    disabled={!newProfile || busy}
                    className="w-full rounded-full font-semibold shadow-xs"
                  >
                    {busy ? 'Assigning...' : '+ Assign to Event'}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Role Permissions Reference Card */}
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Role Permissions
              </h3>
            </div>
            <div className="space-y-3 text-xs">
              {assignable.map((r) => (
                <div key={r.value} className="border-b border-border/50 pb-2.5 last:border-b-0 last:pb-0">
                  <span className="font-bold text-foreground block">{r.label}</span>
                  <span className="text-muted-foreground leading-relaxed mt-0.5 block">
                    {ROLE_DESCRIPTIONS[r.value]}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Active Staff Roster List */}
        <div className="lg:col-span-2">
          <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Assigned Personnel</h2>
                <p className="text-xs text-muted-foreground">
                  Active staff members with access to this gathering.
                </p>
              </div>
            </div>

            {assignments.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Users size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-foreground">No staff assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Assign team members from your organization to help run the check-in gates.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {assignments.map((a) => {
                  const mine = a.profile_id === me
                  const roleObj = ROLES.find((r) => r.value === a.role)
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground text-sm sm:text-base truncate">
                            {a.profiles?.full_name || 'Unnamed member'}
                          </p>
                          {mine && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium">
                              You
                            </Badge>
                          )}
                          <Badge
                            variant={a.on_site ? 'default' : 'outline'}
                            className={cn(
                              'text-[10px] py-0 px-2 font-medium',
                              a.on_site
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : 'text-muted-foreground'
                            )}
                          >
                            <MapPin size={10} className="mr-1 inline" />
                            {a.on_site ? 'On site' : 'Off site'}
                          </Badge>
                        </div>

                        {/* Role selection or display */}
                        <div className="mt-1.5 flex items-center gap-2">
                          {isAdmin && (a.role !== 'owner' || canAssignOwner(myRole)) ? (
                            <div className="w-[180px]">
                              <CustomSelect
                                value={a.role}
                                onChange={(v) => changeRole(a.id, v as Role)}
                                triggerClassName="h-8 rounded-xl text-xs py-1 px-2.5"
                                options={assignable.map((r) => ({
                                  value: r.value,
                                  label: r.label,
                                  dot:
                                    r.value === 'owner'
                                      ? 'bg-purple-500'
                                      : r.value === 'manager'
                                      ? 'bg-emerald-500'
                                      : r.value === 'staff'
                                      ? 'bg-blue-500'
                                      : 'bg-amber-500',
                                }))}
                                aria-label={`Role for ${a.profiles?.full_name ?? 'member'}`}
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">
                              {roleObj?.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {mine && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full text-xs font-semibold gap-1.5"
                            onClick={() => toggleOnSite(a)}
                          >
                            <CheckCircle2 size={13} className={a.on_site ? 'text-primary' : 'text-muted-foreground'} />
                            <span>{a.on_site ? 'Mark Off-Site' : 'Check-In On-Site'}</span>
                          </Button>
                        )}

                        {isAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(a.id)}
                            className="rounded-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove staff assignment"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
