'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface EventSettings {
  registration_token: string
  registration_open: boolean
  registration_capacity: number | null
  approval_mode: 'auto' | 'manual'
}

interface TeamMember {
  id: string
  name: string
  referral_code: string
}

// Random 6-character code, the same shape the database expects for referral codes
const newCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Registration link controls for the organiser: open or close, approval, capacity, and team links
export default function RegistrationSettings({ eventUuid, organizationId }: { eventUuid: string; organizationId: string }) {
  const [settings, setSettings] = useState<EventSettings | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [capacityInput, setCapacityInput] = useState('')
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const load = async () => {
      const [{ data: ev }, { data: team }] = await Promise.all([
        supabase.from('events').select('registration_token, registration_open, registration_capacity, approval_mode').eq('id', eventUuid).single(),
        supabase.from('event_team_members').select('id, name, referral_code').eq('event_id', eventUuid).order('created_at'),
      ])
      if (ev) {
        setSettings(ev as EventSettings)
        setCapacityInput(ev.registration_capacity ? String(ev.registration_capacity) : '')
      }
      setMembers((team ?? []) as TeamMember[])
    }
    load()
  }, [eventUuid])

  if (!settings) return null

  const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const baseLink = `${origin}/register/${settings.registration_token}`
  // The general link has no code, so registrations from it are not credited to a team member
  const linkFor = (code?: string) => (code ? `${baseLink}?ref=${code}` : baseLink)

  const save = async (patch: Partial<EventSettings>, done: string) => {
    setMessage('')
    const { error } = await supabase.from('events').update(patch).eq('id', eventUuid)
    if (error) {
      setMessage("Couldn't save that change. Try again.")
      return
    }
    setSettings((s) => (s ? { ...s, ...patch } : s))
    setMessage(done)
  }

  const saveCapacity = () => {
    const value = capacityInput.trim()
    const n = value === '' ? null : Number(value)
    if (n !== null && (!Number.isInteger(n) || n < 1)) {
      setMessage('Enter a whole number of 1 or more, or leave it empty for no limit.')
      return
    }
    save({ registration_capacity: n }, n ? `Capacity set to ${n}.` : 'No capacity limit.')
  }

  const newLink = async () => {
    if (!window.confirm('Create a new link? The current link will stop working.')) return
    const token = crypto.randomUUID().replace(/-/g, '')
    await save({ registration_token: token }, 'New link created. Share the new link only.')
  }

  const addMember = async () => {
    const name = newName.trim()
    if (!name) {
      setMessage('Enter the team member’s name.')
      return
    }
    // Retry if a generated code is already taken for this event
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode()
      const { data, error } = await supabase
        .from('event_team_members')
        .insert({ event_id: eventUuid, organization_id: organizationId, name, referral_code: code })
        .select('id, name, referral_code')
        .single()
      if (!error && data) {
        setMembers((m) => [...m, data as TeamMember])
        setNewName('')
        setMessage(`${name} added.`)
        return
      }
      if (error?.code !== '23505') break
    }
    setMessage("Couldn't add that team member. Try again.")
  }

  const removeMember = async (member: TeamMember) => {
    if (!window.confirm(`Remove ${member.name}? Their link will stop crediting new registrations.`)) return
    const { error } = await supabase.from('event_team_members').delete().eq('id', member.id)
    if (error) {
      setMessage("Couldn't remove that team member.")
      return
    }
    setMembers((m) => m.filter((x) => x.id !== member.id))
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500)
    })
  }

  const label = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' } as const

  return (
    <section className="card" style={{ padding: '20px', marginBottom: '24px' }} aria-labelledby="registration-heading">
      <h2 id="registration-heading" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Public registration</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Share this link so guests can register themselves. Registrations from team links are credited to that person.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 500 }}>
          <input type="checkbox" checked={settings.registration_open} onChange={(e) => save({ registration_open: e.target.checked }, e.target.checked ? 'Registration is open.' : 'Registration is closed.')} />
          Registration open
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label htmlFor="approval" style={{ fontSize: '14px' }}>Approval</label>
          <select id="approval" className="input-field" style={{ width: 'auto' }} value={settings.approval_mode} onChange={(e) => save({ approval_mode: e.target.value as 'auto' | 'manual' }, 'Approval setting saved.')}>
            <option value="auto">Auto-approve</option>
            <option value="manual">Subject to approval</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <label htmlFor="capacity" style={label}>Capacity</label>
          <input id="capacity" type="number" min={1} className="input-field" style={{ width: '140px' }} placeholder="No limit" value={capacityInput} onChange={(e) => setCapacityInput(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" onClick={saveCapacity}>Save capacity</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="general-link" style={label}>General event link</label>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          Use this for social media, email and other channels where no team member is named.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <code id="general-link" style={{ flex: '1 1 260px', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--color-neutral-light)', border: '1px solid var(--color-border)', fontSize: '13px', wordBreak: 'break-all' }}>{linkFor()}</code>
          <button type="button" className="btn-secondary" onClick={() => copy(linkFor(), 'general')}>{copied === 'general' ? 'Copied' : 'Copy link'}</button>
          <button type="button" className="btn-secondary" onClick={newLink}>New link</button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Team links</h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          Each person's link credits their registrations to them.
        </p>
        {members.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            Add the people who will share this event. Each gets a link that credits their registrations.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {members.map((m) => (
              <li key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                <span style={{ fontWeight: 500, minWidth: '120px' }}>{m.name}</span>
                <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{m.referral_code}</code>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn-secondary" style={{ minHeight: '36px', padding: '6px 12px' }} onClick={() => copy(linkFor(m.referral_code), m.id)}>
                  {copied === m.id ? 'Copied' : 'Copy link'}
                </button>
                <button type="button" className="btn-secondary" style={{ minHeight: '36px', padding: '6px 12px', color: 'var(--color-error-red)' }} onClick={() => removeMember(m)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input className="input-field" style={{ flex: '1 1 200px', width: 'auto' }} placeholder="Team member name" aria-label="Team member name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={addMember}>Add team member</button>
        </div>
      </div>

      {message && <p role="status" style={{ marginTop: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{message}</p>}
    </section>
  )
}
