'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEventRole } from '@/components/EventRoleContext'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { canAssignOwner, canManageTeam, EVENT_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type EventRole as Role } from '@/lib/permissions'

const ROLES: { value: Role; label: string }[] = EVENT_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))

interface Member {
  id: string
  full_name: string | null
}

interface Assignment {
  id: string
  profile_id: string
  role: Role
  on_site: boolean
  profiles: { full_name: string | null } | null
}

// Who works this event, in what role, and who is on site right now
export default function TeamPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [orgId, setOrgId] = useState<string | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const myRole = useEventRole()
  const isAdmin = canManageTeam(myRole)
  // Only an owner can hand out the Owner role
  const assignable = ROLES.filter((r) => r.value !== 'owner' || canAssignOwner(myRole))
  const [members, setMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [newProfile, setNewProfile] = useState('')
  const [newRole, setNewRole] = useState<Role>('staff')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMe(user.id)

      const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).single()
      if (!profile) {
        setError('Your profile could not be loaded.')
        return
      }
      setOrgId(profile.organization_id)

      const [membersRes, assignRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('organization_id', profile.organization_id).order('full_name'),
        supabase
          .from('event_staff_assignments')
          .select('id, profile_id, role, on_site, profiles(full_name)')
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
    const { error: insertError } = await supabase.from('event_staff_assignments').insert([
      { event_id: eventUuid, organization_id: orgId, profile_id: newProfile, role: newRole },
    ])
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewProfile('')
    load()
  }

  const changeRole = async (id: string, role: Role) => {
    const { error: updateError } = await supabase.from('event_staff_assignments').update({ role }).eq('id', id)
    if (updateError) setError(updateError.message)
    else load()
  }

  const toggleOnSite = async (a: Assignment) => {
    const { error: updateError } = await supabase.from('event_staff_assignments').update({ on_site: !a.on_site }).eq('id', a.id)
    if (updateError) setError(updateError.message)
    else load()
  }

  const remove = async (id: string) => {
    const { error: deleteError } = await supabase.from('event_staff_assignments').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else load()
  }

  if (loading) return <p>Loading team...</p>

  const card = 'rounded-xl border border-border bg-card p-4'

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="text-lg font-semibold">Team on this event</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignments.length} assigned · {onSiteCount} on site now
        </p>
        <ul className="mt-2.5 grid gap-1 text-[13px] text-muted-foreground">
          {assignable.map((r) => <li key={r.value}><b>{r.label}:</b> {ROLE_DESCRIPTIONS[r.value]}</li>)}
        </ul>
        {error && <Alert variant="error" className="mt-3">{error}</Alert>}
      </section>

      {isAdmin && (
        <section className={card}>
          <h3 className="mb-2.5 text-base font-semibold">Add someone</h3>
          {members.length > 0 && unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone in your organisation is already on this event.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <NativeSelect value={newProfile} onChange={(e) => setNewProfile(e.target.value)} className="max-w-65" aria-label="Team member">
                <option value="">Choose a person</option>
                {unassigned.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name || 'Unnamed member'}</option>
                ))}
              </NativeSelect>
              <NativeSelect value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="max-w-50" aria-label="Role">
                {assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </NativeSelect>
              <Button type="button" onClick={addMember} disabled={!newProfile}>Add</Button>
            </div>
          )}
        </section>
      )}

      <section className={card}>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one is assigned to this event yet.</p>
        ) : (
          <ul className="grid gap-2.5">
            {assignments.map((a) => {
              const mine = a.profile_id === me
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-semibold">
                      {a.profiles?.full_name || 'Unnamed member'}
                      {mine && <span className="font-normal text-muted-foreground"> (you)</span>}
                    </p>
                    {isAdmin && (a.role !== 'owner' || canAssignOwner(myRole)) ? (
                      <NativeSelect value={a.role} onChange={(e) => changeRole(a.id, e.target.value as Role)} className="mt-1 max-w-50" aria-label={`Role for ${a.profiles?.full_name ?? 'member'}`}>
                        {assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </NativeSelect>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">{ROLES.find((r) => r.value === a.role)?.label}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[13px] font-semibold', a.on_site ? 'text-[var(--color-live)]' : 'text-muted-foreground')}>
                      {a.on_site ? 'On site' : 'Off site'}
                    </span>
                    {mine && (
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleOnSite(a)}>
                        {a.on_site ? 'Mark off site' : 'Mark on site'}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button type="button" variant="outline" size="sm" onClick={() => remove(a.id)}>Remove</Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
