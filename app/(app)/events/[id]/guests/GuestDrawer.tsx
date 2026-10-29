'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Pencil, Printer, Trash2, Undo2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useConfirm } from '@/components/ConfirmDialog'
import { countryName } from '@/lib/countries'
import { attendanceConfirmationLabel, registrationStatusLabel, type Guest } from '@/lib/guests'
import { formatDateTime } from '@/lib/time'
import { canCheckIn, canDeleteGuests, canManageEvent, canManageGuests } from '@/lib/permissions'
import { useEventRole } from '@/components/EventRoleContext'
import AttendeeForm from './AttendeeForm'

interface Props {
  eventUuid: string
  eventCountry: string
  guests: Guest[]
  /** The guest to show, or null when adding a new one. */
  guest: Guest | null
  mode: 'view' | 'edit' | 'add'
  checkedIn: boolean
  onMode: (mode: 'view' | 'edit') => void
  onClose: () => void
  /** Something changed in the database: reload the list. */
  onChanged: (message?: string) => void
  onDelete: (id: string) => void
}

interface Activity {
  at: string
  label: string
  detail?: string
  tone: 'default' | 'good' | 'warn'
}

interface Extra {
  badge_token: string
  created_at: string
  source: string
  badge_collected_at: string | null
  badge_collected_by: string | null
}

// Slide-over on narrower screens, docked as the right-hand 40% on wide ones (the parent decides the grid).
// Shows one guest's details, what has happened to them, and the quick actions.
export default function GuestDrawer({ eventUuid, eventCountry, guests, guest, mode, checkedIn, onMode, onClose, onChanged, onDelete }: Props) {
  const role = useEventRole()
  const { confirm, dialog } = useConfirm()
  const [activity, setActivity] = useState<Activity[]>([])
  const [extra, setExtra] = useState<Extra | null>(null)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOrigin(window.location.origin), [])

  // Move focus into the drawer when it opens, and let Esc close it
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, guest?.id, mode])

  const guestId = guest?.id
  const loadActivity = useCallback(async () => {
    if (!guestId) return
    const [reg, checkins, prints] = await Promise.all([
      supabase.from('registrations').select('badge_token, created_at, source, badge_collected_at, badge_collected_by').eq('id', guestId).single(),
      supabase.from('checkins').select('checked_in_at, method, checked_in_by').eq('registration_id', guestId),
      supabase.from('badge_prints').select('printed_at, printed_by').eq('registration_id', guestId),
    ])
    const r = reg.data as Extra | null
    setExtra(r)
    const items: Activity[] = []
    if (r) items.push({ at: r.created_at, label: 'Registered', detail: `via ${r.source === 'import' ? 'import' : r.source === 'walkin' ? 'walk-in' : 'manual entry'}`, tone: 'default' })
    for (const c of (checkins.data ?? []) as { checked_in_at: string; method: string; checked_in_by: string | null }[]) {
      items.push({ at: c.checked_in_at, label: 'Checked in', detail: [c.checked_in_by, c.method].filter(Boolean).join(' · '), tone: 'good' })
    }
    for (const p of (prints.data ?? []) as { printed_at: string; printed_by: string }[]) {
      items.push({ at: p.printed_at, label: 'Badge printed', detail: p.printed_by, tone: 'default' })
    }
    if (r?.badge_collected_at) items.push({ at: r.badge_collected_at, label: 'Badge collected', detail: r.badge_collected_by ?? undefined, tone: 'good' })
    setActivity(items.sort((a, b) => b.at.localeCompare(a.at)))
  }, [guestId])

  // Reload when the guest changes or their check-in state flips (live updates from other devices)
  useEffect(() => {
    setExtra(null)
    setActivity([])
    setMessage('')
    loadActivity()
  }, [loadActivity, checkedIn])

  const passUrl = extra && origin ? `${origin}/pass/${extra.badge_token}` : ''

  const copyPass = async () => {
    if (!passUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: `Pass for ${guest?.full_name}`, url: passUrl })
        return
      }
      await navigator.clipboard.writeText(passUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* cancelled or blocked: the link is shown below to copy by hand */
    }
  }

  const undoCheckIn = async () => {
    if (!guest) return
    const ok = await confirm({
      title: `Undo check-in for ${guest.full_name}?`,
      description: 'They will show as not arrived again. Their badge status is not changed.',
      confirmLabel: 'Undo check-in',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('undo_check_in', { p_registration_id: guest.id })
    setBusy(false)
    if (error) {
      setMessage(
        error.code === 'PGRST202'
          ? 'Undo is not available yet. The latest database update (SQL/021) has not been applied.'
          : error.code === '42501'
            ? 'Your role cannot undo check-ins.'
            : 'Could not undo the check-in. Try again.'
      )
      return
    }
    onChanged(`Check-in undone for ${guest.full_name}.`)
    loadActivity()
  }

  const title = mode === 'add' ? 'Add guest' : guest?.full_name ?? ''

  return (
    <>
      {dialog}
      {/* Backdrop only below xl, where the drawer overlays the table */}
      <button type="button" aria-label="Close guest panel" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-black/30 xl:hidden" />
      <aside
        aria-label={title}
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-xl xl:sticky xl:top-20 xl:z-auto xl:max-h-[calc(100vh-6rem)] xl:max-w-none xl:self-start xl:rounded-xl xl:border xl:shadow-none"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-background px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            {guest && (
              <p className="truncate text-sm text-muted-foreground">
                <span className="font-mono">{guest.registration_id}</span>
                {guest.designation ? ` · ${guest.designation}` : ''}
                {guest.company ? ` · ${guest.company}` : ''}
              </p>
            )}
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        {mode !== 'view' || !guest ? (
          <div className="p-4">
            <AttendeeForm
              key={guest?.id ?? 'new'}
              eventUuid={eventUuid}
              eventCountry={eventCountry}
              existing={guests}
              attendee={guest ?? undefined}
              onDone={(m) => onChanged(m)}
              onCancel={() => (guest ? onMode('view') : onClose())}
            />
          </div>
        ) : (
          <div className="grid gap-5 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={checkedIn ? 'default' : 'secondary'}>{checkedIn ? 'Checked in' : 'Not arrived'}</Badge>
              <Badge variant="outline">{registrationStatusLabel(guest.registration_status)}</Badge>
              <Badge variant="outline">{attendanceConfirmationLabel(guest.attendance_confirmation)}</Badge>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              {canManageGuests(role) && (
                <Button variant="outline" size="sm" onClick={() => onMode('edit')}><Pencil className="size-4" />Edit</Button>
              )}
              {canManageEvent(role) && (
                <Button variant="outline" size="sm" render={<Link href={`/events/${eventUuid}/badges?guest=${guest.id}`} />} nativeButton={false}>
                  <Printer className="size-4" />Print badge
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={copyPass} disabled={!passUrl}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Share pass link'}
              </Button>
              {passUrl && (
                <Button variant="outline" size="sm" render={<a href={`/pass/${extra?.badge_token}`} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                  <ExternalLink className="size-4" />Open pass
                </Button>
              )}
              {checkedIn && canCheckIn(role) && (
                <Button variant="destructive" size="sm" onClick={undoCheckIn} disabled={busy}><Undo2 className="size-4" />Undo check-in</Button>
              )}
              {canDeleteGuests(role) && (
                <Button variant="destructive" size="sm" onClick={() => onDelete(guest.id)}><Trash2 className="size-4" />Delete</Button>
              )}
            </div>
            {message && <p role="alert" className="text-sm text-destructive">{message}</p>}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {([
                ['Work email', guest.company_email],
                ['Personal email', guest.email],
                ['Phone', guest.phone],
                ['Company', guest.company],
                ['Designation', guest.designation],
                ['Country', countryName(guest.country)],
                ['City', guest.city],
                ['Industry', guest.industry],
              ] as [string, string | null | undefined][]).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words">{v || '—'}</dd>
                </div>
              ))}
            </dl>

            <section aria-labelledby="activity-heading">
              <h3 id="activity-heading" className="mb-2 text-sm font-semibold">Activity</h3>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <ol className="grid gap-3 border-l border-border pl-4">
                  {activity.map((a, i) => (
                    <li key={i} className="relative text-sm">
                      <span
                        aria-hidden="true"
                        className={'absolute -left-[21px] top-1.5 size-2.5 rounded-full ' + (a.tone === 'good' ? 'bg-primary' : 'bg-muted-foreground/50')}
                      />
                      <div className="font-medium">{a.label}</div>
                      <div className="text-muted-foreground">{formatDateTime(a.at)}{a.detail ? ` · ${a.detail}` : ''}</div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </aside>
    </>
  )
}
