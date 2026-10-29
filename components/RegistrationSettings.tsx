'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

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

export interface RegistrationRow {
  registration_status: string
  referral_member_id: string | null
  badge_collected_at: string | null
  checkins: { checked_in_at: string }[]
}

// Random 6-character code, the same shape the database expects for referral codes
const newCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Registration link controls for the organiser: open or close, approval, capacity, and team links
export default function RegistrationSettings({ eventUuid, organizationId, registrations }: { eventUuid: string; organizationId: string; registrations: RegistrationRow[] }) {
  const { confirm, dialog } = useConfirm()
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
    if (!(await confirm({ title: 'Create a new link?', description: 'The current link will stop working.', confirmLabel: 'Create new link', destructive: true }))) return
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
    if (!(await confirm({ title: `Remove ${member.name}?`, description: 'Their link will stop crediting new registrations.', confirmLabel: 'Remove', destructive: true }))) return
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

  const label = 'mb-1.5 block text-sm font-medium'

  return (
    <>
    {dialog}
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="registration-heading">
      <h2 id="registration-heading" className="mb-1 text-lg font-semibold">Public registration</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Share this link so guests can register themselves. Registrations from team links are credited to that person.
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" className="accent-primary" checked={settings.registration_open} onChange={(e) => save({ registration_open: e.target.checked }, e.target.checked ? 'Registration is open.' : 'Registration is closed.')} />
          Registration open
        </label>
        <div className="flex items-center gap-2">
          <label htmlFor="approval" className="text-sm">Approval</label>
          <NativeSelect id="approval" className="h-10 w-auto" value={settings.approval_mode} onChange={(e) => save({ approval_mode: e.target.value as 'auto' | 'manual' }, 'Approval setting saved.')}>
            <option value="auto">Auto-approve</option>
            <option value="manual">Subject to approval</option>
          </NativeSelect>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="capacity" className={label}>Capacity</label>
          <Input id="capacity" type="number" min={1} className="h-10 w-[140px]" placeholder="No limit" value={capacityInput} onChange={(e) => setCapacityInput(e.target.value)} />
        </div>
        <Button type="button" variant="outline" className="h-10" onClick={saveCapacity}>Save capacity</Button>
      </div>

      <div className="mb-4">
        <label htmlFor="general-link" className={label}>General event link</label>
        <p className="mb-2 text-[13px] text-muted-foreground">
          Use this for social media, email and other channels where no team member is named.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code id="general-link" className="flex-1 basis-[260px] rounded-lg border border-border bg-muted px-3 py-2.5 text-[13px] break-all">{linkFor()}</code>
          <Button type="button" variant="outline" onClick={() => copy(linkFor(), 'general')}>{copied === 'general' ? 'Copied' : 'Copy link'}</Button>
          <Button type="button" variant="outline" onClick={newLink}>New link</Button>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-[15px] font-semibold">Team links</h3>
        <p className="mb-2 text-[13px] text-muted-foreground">
          Each person's link credits their registrations to them.
        </p>
        {members.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Add the people who will share this event. Each gets a link that credits their registrations.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border px-3 py-2.5">
                <span className="min-w-[120px] font-medium">{m.name}</span>
                <code className="text-xs text-muted-foreground">{m.referral_code}</code>
                <span className="text-[13px] text-muted-foreground">
                  {registrations.filter((r) => r.referral_member_id === m.id && !['cancelled', 'rejected'].includes(r.registration_status)).length} registered
                </span>
                <span className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => copy(linkFor(m.referral_code), m.id)}>
                  {copied === m.id ? 'Copied' : 'Copy link'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => removeMember(m)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Input className="h-10 min-w-[200px] flex-1" placeholder="Team member name" aria-label="Team member name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="button" onClick={addMember}>Add team member</Button>
        </div>
      </div>

      {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
    </>
  )
}
