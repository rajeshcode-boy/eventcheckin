'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { publicImageUrl } from '@/lib/images'

const NAV = [
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
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-white)' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'var(--color-neutral-light)',
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <Link href="/events" style={{ fontWeight: 'bold', fontSize: '18px' }}>
            EventCheckin
          </Link>
          <nav aria-label="Main" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    padding: '8px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: active ? 600 : 400,
                    backgroundColor: active ? 'var(--color-white)' : undefined,
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/profile" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} aria-label="My profile">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary-green)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px' }}>
                {(displayName || user?.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              {displayName || user?.email}
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className="btn-secondary"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ padding: '24px' }}>
        {children}
      </main>
    </div>
  )
}
