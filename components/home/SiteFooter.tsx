import Link from 'next/link'
import { CookieSettingsButton } from '@/components/Analytics'
import { BrandMark } from './SiteHeader'
import { BOOKING_URL, CONTACT_EMAIL } from './content'

const linkClass = 'text-sm text-muted-foreground hover:text-foreground'

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-bold">
            <BrandMark className="size-8 text-sm" />
            EventCheckin
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Guest lists, QR check-in, badges and live attendance for conferences, summits and corporate events.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider">Product</h2>
          <ul className="space-y-2">
            <li><a href="/#features" className={linkClass}>Features</a></li>
            <li><a href="/#how-it-works" className={linkClass}>How it works</a></li>
            <li><a href="/#demo" className={linkClass}>Demo</a></li>
            <li><a href="/#pricing" className={linkClass}>Pricing</a></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider">Get started</h2>
          <ul className="space-y-2">
            <li><Link href="/signup" className={linkClass}>Create an account</Link></li>
            <li><Link href="/login" className={linkClass}>Log in</Link></li>
            <li><a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Book a demo</a></li>
            <li><a href="/#faq" className={linkClass}>FAQ</a></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider">Company</h2>
          <ul className="space-y-2">
            <li><a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>Contact us</a></li>
            <li><Link href="/privacy" className={linkClass}>Privacy Policy</Link></li>
            <li><Link href="/terms" className={linkClass}>Terms of Service</Link></li>
            <li><CookieSettingsButton className={linkClass} /></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 EventCheckin. All rights reserved.</p>
          <p>Runs in your browser. Nothing to install.</p>
        </div>
      </div>
    </footer>
  )
}
