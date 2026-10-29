'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeMenu from '@/components/ThemeMenu'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from './content'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex size-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground', className)}
    >
      ✓
    </span>
  )
}

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md transition-shadow',
        scrolled ? 'border-border shadow-sm' : 'border-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight" onClick={() => setOpen(false)}>
          <BrandMark />
          EventCheckin
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeMenu />
          <Button variant="ghost" className="hidden sm:inline-flex" render={<Link href="/login" />} nativeButton={false}>
            Log in
          </Button>
          <Button className="hidden sm:inline-flex" render={<Link href="/signup" />} nativeButton={false}>
            Start for free
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-border bg-background px-4 pb-5 pt-2 md:hidden">
          <nav aria-label="Main" className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-base font-medium hover:bg-secondary">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" render={<Link href="/login" />} nativeButton={false}>
              Log in
            </Button>
            <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
              Start for free
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
