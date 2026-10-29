'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEventRole } from '@/components/EventRoleContext'
import { canDeleteEvent } from '@/lib/permissions'

interface Props {
  eventUuid: string
  name: string
  archivedAt: string | null
  bannerPath: string | null
  logoPath: string | null
}

type Dialog = 'confirm-delete' | 'not-admin' | 'deleted' | null

// Archive hides an event from the lists and keeps its data. Delete removes everything (event owners only).
export default function EventLifecycle({ eventUuid, name, archivedAt, bannerPath, logoPath }: Props) {
  const router = useRouter()
  const role = useEventRole()
  const isAdmin = canDeleteEvent(role)
  const [archived, setArchived] = useState(!!archivedAt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)


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

  const askToDelete = () => {
    setDialog(isAdmin ? 'confirm-delete' : 'not-admin')
  }

  const deleteEvent = async () => {
    setDialog(null)
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
      setError(deleteError?.message ?? 'The event could not be deleted. Only event owners can delete events.')
      return
    }
    setDialog('deleted')
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

      <section style={{ ...section, borderColor: 'var(--color-error-red)', backgroundColor: '#fff5f5' }} aria-label="Danger zone">
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-error-red)', marginBottom: '6px' }}>Delete event</h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          Permanently removes this event and all of its information from the database: guests, registrations, check-ins, badges, team assignments and reports. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={askToDelete}
          disabled={busy}
          style={{ width: 'auto', minHeight: '44px', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', color: '#fff', backgroundColor: 'var(--color-error-red)', border: 'none', cursor: 'pointer' }}
        >
          Delete event
        </button>
      </section>

      {error && <p className="alert-error">{error}</p>}

      {dialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="lifecycle-dialog-title" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 100 }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--color-surface)', borderRadius: '14px', boxShadow: 'var(--shadow-pop)', padding: '24px' }}>
            {dialog === 'confirm-delete' && (
              <>
                <h2 id="lifecycle-dialog-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>Delete this event?</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Everything in this event will be lost for good: guests, registrations, check-ins, badges, team assignments and reports. Download your data first if you might need it later.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={() => setDialog(null)}>Cancel</button>
                  <button
                    type="button"
                    onClick={deleteEvent}
                    style={{ width: 'auto', minHeight: '44px', padding: '10px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '15px', color: '#fff', backgroundColor: 'var(--color-error-red)', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5" />
                    </svg>
                    Yes, delete event
                  </button>
                </div>
              </>
            )}

            {dialog === 'not-admin' && (
              <>
                <h2 id="lifecycle-dialog-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>Only owners can delete</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  Only an event owner can delete events. Ask an owner to delete this event.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setDialog(null)}>OK</button>
                </div>
              </>
            )}

            {dialog === 'deleted' && (
              <>
                <h2 id="lifecycle-dialog-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>Event deleted</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                  {name} and all of its information has been removed.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => router.push('/events')}>OK</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
