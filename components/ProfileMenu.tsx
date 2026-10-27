'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Props {
  name: string
  email: string
  avatarUrl: string | null
  onLogout: () => void
}

// Avatar button that opens a menu with the account and the log out action
export default function ProfileMenu({ name, email, avatarUrl, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const initial = (name || email || '?').charAt(0).toUpperCase()

  // Close on outside click or Escape, and return focus to the trigger
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    color: 'var(--color-text-primary)',
    background: 'none',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name || email}`}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px', borderRadius: '999px', background: 'none' }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary-green)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px' }}>
            {initial}
          </span>
        )}
        <span className="app-user-name" style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {name || email}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="card"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '240px', padding: '6px', boxShadow: 'var(--shadow-pop)', zIndex: 30 }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: '4px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Signed in'}</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
          </div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} style={itemStyle}>
            My profile
          </Link>
          <Link href="/organization" role="menuitem" onClick={() => setOpen(false)} style={itemStyle}>
            Organization settings
          </Link>
          <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onLogout() }} style={{ ...itemStyle, color: 'var(--color-error-red)', fontWeight: 500 }}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
