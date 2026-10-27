'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const FEATURES = [
  {
    title: 'Guest lists in minutes',
    body: 'Import guests from a CSV or Excel file, or let them register through your own branded form.',
  },
  {
    title: 'QR badges, ready to print',
    body: 'Every guest gets a QR badge you can print or send. Scanning it finds them instantly.',
  },
  {
    title: 'Live check-in',
    body: 'Check guests in at the door from any phone, and see who has arrived as it happens.',
  },
  {
    title: 'Reports and pickup history',
    body: 'Export attendance reports and keep a record of every pickup for your events.',
  },
]

export default function Home() {
  const router = useRouter()

  // Signed-in organisers go straight to their events; everyone else sees the landing page
  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active && session) router.replace('/events')
      })
      .catch(() => {
        // Stay on the landing page if the session check fails
      })
    return () => {
      active = false
    }
  }, [router])

  return (
    <div className="home-page">
      <header className="home-header">
        <Link href="/" className="home-brand">
          EventCheckin
        </Link>
        <nav className="home-header-nav" aria-label="Account">
          <Link href="/login" className="home-link">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary home-header-cta">
            Sign up
          </Link>
        </nav>
      </header>

      <main>
        <section className="home-hero">
          <p className="home-eyebrow">Event check-in for small organisers</p>
          <h1 className="home-title">Check guests in without the queue.</h1>
          <p className="home-lead">
            Build your guest list, send QR badges, and check people in from your phone. EventCheckin
            is simple enough to start on the day you need it.
          </p>
          <div className="home-actions">
            <Link href="/signup" className="btn-primary">
              Create a free account
            </Link>
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
          </div>
        </section>

        <section className="home-features" aria-label="What you can do">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card home-feature">
              <h2 className="home-feature-title">{feature.title}</h2>
              <p className="home-feature-body">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="home-closing">
          <h2 className="home-closing-title">Ready for your next event?</h2>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </section>
      </main>

      <footer className="home-footer">
        <span>EventCheckin</span>
        <span className="home-footer-links">
          <Link href="/login" className="home-link">
            Log in
          </Link>
          <Link href="/signup" className="home-link">
            Sign up
          </Link>
        </span>
      </footer>
    </div>
  )
}
