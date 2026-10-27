'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
}

const NAV: NavItem[] = [
  {
    href: '/events',
    label: 'Events',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: '/organization',
    label: 'Organization',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 21v-7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7M9 7h.01M9 11h.01M9 15h.01M4 21h16" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'My Profile',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

// Persistent left-hand navigation for signed-in pages, shown above the 640px breakpoint
// (phones use the bottom tab bar instead; see .app-sidebar in globals.css).
export default function AppSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="app-sidebar" aria-label="Main">
      {orgName && <p className="app-sidebar-org">{orgName}</p>}
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="app-sidebar-link"
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </aside>
  )
}
