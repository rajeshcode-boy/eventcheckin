'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { publicImageUrl } from '@/lib/images'
import ThemeToggle from '@/components/ThemeToggle'
import ProfileMenu from '@/components/ProfileMenu'
import EventNotifications from '@/components/EventNotifications'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/events', label: 'Events' },
  { href: '/organization', label: 'Organization' },
  { href: '/profile', label: 'My Profile' },
]

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Name and photo for the header; refreshed when the profile page saves a photo
  useEffect(() => {
    if (!user) return
    const loadProfile = () =>
      supabase.from('profiles').select('full_name, profile_photo_url').eq('id', user.id).single().then(({ data }) => {
        setDisplayName(data?.full_name ?? '')
        setAvatarUrl(publicImageUrl('avatars', data?.profile_photo_url))
      })
    loadProfile()
    window.addEventListener('profile-updated', loadProfile)
    return () => window.removeEventListener('profile-updated', loadProfile)
  }, [user])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)
      setLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })

    return () => subscription?.unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login?signedout=1')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    )
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-neutral-light)' }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '10px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', minWidth: 0 }}>
          <Link href="/events" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            <span aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>✓</span>
            EventCheckin
          </Link>
          <nav aria-label="Main" className="app-nav-desktop" style={{ display: 'flex', gap: '4px' }}>
            {NAV.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    padding: '7px 12px', borderRadius: '999px', fontSize: '14px', fontWeight: active ? 600 : 500,
                    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    backgroundColor: active ? 'var(--color-primary-soft)' : undefined,
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <EventNotifications />
          <ThemeToggle />
          <ProfileMenu
            name={displayName}
            email={user?.email ?? ''}
            avatarUrl={avatarUrl}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="app-main" style={{ padding: '32px 24px', maxWidth: '1040px', margin: '0 auto' }}>
        {children}
      </main>

      {/* Bottom tabs on phones */}
      <nav aria-label="Main" className="app-tabbar">
        {NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: active ? 600 : 500 }}
            >
              {item.label === 'My Profile' ? 'Profile' : item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
