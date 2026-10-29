'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEventRole } from '@/components/EventRoleContext'
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

  const card = { padding: '16px 18px' } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="card" style={card}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Team on this event</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          {assignments.length} assigned · {onSiteCount} on site now
        </p>
        <ul style={{ listStyle: 'none', marginTop: '10px', display: 'grid', gap: '4px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {assignable.map((r) => <li key={r.value}><b>{r.label}:</b> {ROLE_DESCRIPTIONS[r.value]}</li>)}
        </ul>
        {error && <p className="alert-error" style={{ marginTop: '12px' }}>{error}</p>}
      </section>

      {isAdmin && (
        <section className="card" style={card}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Add someone</h3>
          {members.length > 0 && unassigned.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Everyone in your organisation is already on this event.</p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={newProfile} onChange={(e) => setNewProfile(e.target.value)} className="input-field" style={{ maxWidth: '260px' }} aria-label="Team member">
                <option value="">Choose a person</option>
                {unassigned.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name || 'Unnamed member'}</option>
                ))}
              </select>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="input-field" style={{ maxWidth: '200px' }} aria-label="Role">
                {assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={addMember} disabled={!newProfile}>Add</button>
            </div>
          )}
        </section>
      )}

      <section className="card" style={card}>
        {assignments.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>No one is assigned to this event yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'grid', gap: '10px' }}>
            {assignments.map((a) => {
              const mine = a.profile_id === me
              return (
                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{a.profiles?.full_name || 'Unnamed member'}{mine && <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> (you)</span>}</p>
                    {isAdmin && (a.role !== 'owner' || canAssignOwner(myRole)) ? (
                      <select value={a.role} onChange={(e) => changeRole(a.id, e.target.value as Role)} className="input-field" style={{ marginTop: '4px', maxWidth: '200px' }} aria-label={`Role for ${a.profiles?.full_name ?? 'member'}`}>
                        {assignable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{ROLES.find((r) => r.value === a.role)?.label}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: a.on_site ? 'var(--color-live)' : 'var(--color-text-secondary)' }}>
                      {a.on_site ? 'On site' : 'Off site'}
                    </span>
                    {mine && (
                      <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: '36px' }} onClick={() => toggleOnSite(a)}>
                        {a.on_site ? 'Mark off site' : 'Mark on site'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: '36px' }} onClick={() => remove(a.id)}>Remove</button>
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
