'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Props {
  eventUuid: string
  name: string
  archivedAt: string | null
  bannerPath: string | null
  logoPath: string | null
}

const DELETE_WARNING =
  'Delete this event?\n\nAll of its information will be removed from the database: guests, registrations, check-ins, badges, team assignments and reports.\n\nThis cannot be undone.\n\nWould you still like to delete?'

// Archive hides an event from the lists and keeps its data. Delete removes everything (admins only).
export default function EventLifecycle({ eventUuid, name, archivedAt, bannerPath, logoPath }: Props) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [archived, setArchived] = useState(!!archivedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(profile?.role === 'admin')
    }
    load()
  }, [])

  const toggleArchive = async () => {
    setBusy(true)
    setError('')
    const { error: updateError } = await supabase
      .from('events')
      .update({ archived_at: archived ? null : new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', eventUuid)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setArchived(!archived)
  }

  const deleteEvent = async () => {
    if (!confirm(DELETE_WARNING)) return
    setBusy(true)
    setError('')

    // Uploaded images go too; a failure here must not block deleting the event
    const paths = [bannerPath, logoPath].filter((p): p is string => !!p)
    if (paths.length > 0) {
      await supabase.storage.from('branding').remove(paths).catch(() => undefined)
    }

    const { data, error: deleteError } = await supabase.from('events').delete().eq('id', eventUuid).select('id')
    setBusy(false)
    if (deleteError || !data || data.length === 0) {
      setError(deleteError?.message ?? 'The event could not be deleted. Only admins can delete events.')
      return
    }

    alert(`Event deleted: ${name}`)
    router.push('/events')
  }

  const section = { marginTop: '32px', padding: '18px', borderRadius: '10px', border: '1px solid var(--color-border)' } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="card" style={{ padding: '18px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>{archived ? 'Archived' : 'Archive event'}</h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          {archived
            ? 'This event is hidden from the event lists. Its data is kept and you can restore it at any time.'
            : 'Hide this event from the event lists. Its data is kept and you can restore it at any time.'}
        </p>
        <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={toggleArchive} disabled={busy}>
          {archived ? 'Restore event' : 'Archive event'}
        </button>
      </section>

      {isAdmin && (
        <section style={{ ...section, borderColor: 'var(--color-error-red)', backgroundColor: '#fff5f5' }} aria-label="Danger zone">
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-error-red)', marginBottom: '6px' }}>Delete event</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            Permanently removes this event and all of its information from the database: guests, registrations, check-ins, badges, team assignments and reports. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={deleteEvent}
            disabled={busy}
            style={{ width: 'auto', minHeight: '44px', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', color: '#fff', backgroundColor: 'var(--color-error-red)', border: 'none', cursor: 'pointer' }}
          >
            Delete event
          </button>
        </section>
      )}

      {error && <p className="alert-error">{error}</p>}
    </div>
  )
}
