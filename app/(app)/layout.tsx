'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { publicImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import ThemeMenu from '@/components/ThemeMenu'
import ProfileMenu from '@/components/ProfileMenu'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import EventNotifications from '@/components/EventNotifications'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { identifyOrganiser, resetAnalytics } from '@/lib/analytics'

const NAV: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/events', label: 'Events' },
  { href: '/organization', label: 'Organization', adminOnly: true },
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
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Name and photo for the header; refreshed when the profile page saves a photo
  useEffect(() => {
    if (!user) return
    identifyOrganiser(user.id)
    const loadProfile = () =>
      supabase.from('profiles').select('full_name, profile_photo_url, role').eq('id', user.id).single().then(({ data }) => {
        setDisplayName(data?.full_name ?? '')
        setIsOrgAdmin(data?.role === 'admin')
        setAvatarUrl(publicImageUrl('avatars', data?.profile_photo_url))
      })
      // Separate select: is_master_admin only exists once SQL/024 is applied, and must never
      // break the name/photo load above in the meantime.
      supabase.from('profiles').select('is_master_admin').eq('id', user.id).single().then(({ data, error }) => {
        setIsMasterAdmin(!error && data?.is_master_admin === true)
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
    resetAnalytics()
    router.push('/login?signedout=1')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // Organisation settings are for admins; event roles never grant them
  const nav = NAV.filter((item) => !item.adminOnly || isOrgAdmin)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/events" className="flex items-center gap-2 whitespace-nowrap text-[17px] font-bold tracking-tight">
            <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">✓</span>
            EventCheckin
          </Link>
          <NavigationMenu className="justify-start max-sm:hidden">
            <NavigationMenuList>
              {nav.map((item) => (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink active={isActive(item.href)} render={<Link href={item.href} />}>
                    {item.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex items-center gap-3">
          <EventNotifications />
          <ThemeMenu />
          <ProfileMenu
            name={displayName}
            email={user?.email ?? ''}
            avatarUrl={avatarUrl}
            isMasterAdmin={isMasterAdmin}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full px-8 py-8 max-sm:px-4 max-sm:pt-4 max-sm:pb-24">
        {children}
      </main>

      {/* Bottom tabs on phones */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 hidden justify-around border-t border-border bg-card px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] max-sm:flex">
        {nav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-1 py-2.5 text-center text-sm',
                active ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'
              )}
            >
              {item.label === 'My Profile' ? 'Profile' : item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
