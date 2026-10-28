'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface NotifItem {
  id: string
  text: string
  at: string
}

export default function EventNotifications({ eventUuid }: { eventUuid: string }) {
  const [items, setItems] = useState<NotifItem[]>([])
  const [open, setOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const push = (text: string) =>
      setItems((prev) => [{ id: crypto.randomUUID(), text, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 30))

    const channel = supabase
      .channel(`event-notifs-${eventUuid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const r = payload.new as { full_name?: string; source?: string }
          const who = r.full_name ?? 'Guest'
          push(r.source === 'walkin' ? `${who} walked in` : `${who} registered`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkins', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const c = payload.new as { full_name?: string }
          push(`${c.full_name ?? 'Guest'} checked in`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` },
        (payload) => {
          const r = payload.new as { full_name?: string; badge_collected_at?: string | null }
          const old = payload.old as { badge_collected_at?: string | null }
          if (r.badge_collected_at && !old.badge_collected_at) {
            push(`${r.full_name ?? 'Guest'} picked up badge`)
          }
        }
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [eventUuid])

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unread = items.length

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          backgroundColor: open ? 'var(--color-primary-soft)' : 'var(--color-surface)',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '16px',
            height: '16px',
            borderRadius: '999px',
            backgroundColor: 'var(--color-error-red)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {connected && (
          <span aria-hidden="true" style={{
            position: 'absolute',
            bottom: '-3px',
            right: '-3px',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-live)',
            border: '1px solid var(--color-surface)',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '280px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-pop)',
          zIndex: 50,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Live activity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: connected ? 'var(--color-live)' : 'var(--color-text-secondary)' }}>
                {connected ? '● live' : '○ connecting…'}
              </span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'none', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {items.length === 0 ? (
              <p style={{ padding: '20px 14px', fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                No activity yet — updates appear here in real time.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {items.map((item) => (
                  <li key={item.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{item.text}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0, marginTop: '2px' }}>{item.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
