'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import './home.css'

const TABS = [
  { id: 'check-in', label: 'Check-in' },
  { id: 'badges', label: 'Badges' },
  { id: 'guests', label: 'Guest lists' },
]

const FAQS = [
  { q: 'What is EventCheckin?', a: 'A web app for organisers to import guests, check them in at the registration desk and see live attendance.' },
  { q: 'Does it work on phones?', a: 'Yes. Check-in runs in the browser on phones, tablets and laptops.' },
  { q: 'How much does it cost?', a: '[PRICE]. Replace with the final pricing once it is set.' },
]

export default function Home() {
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState('check-in')

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

  // Header: shrink after the first scroll, hide while scrolling down
  useEffect(() => {
    let lastY = 0
    const onScroll = () => {
      const y = window.scrollY
      const nav = navRef.current
      if (nav) {
        nav.classList.toggle('scrolled', y > 8)
        nav.classList.toggle('hidden', y > lastY && y > 240)
      }
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reveal sections as they scroll into view
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="hp" ref={pageRef}>
      <nav className="top" ref={navRef}>
        <div className="wrap">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true">&#10003;</span>
            EventCheckin
          </Link>
          <div className="menu">
            <a href="#features">Products</a>
            <a href="#features">Solutions</a>
            <a href="#pricing">Pricing</a>
            <a href="#">Customers</a>
            <a href="#">Resources</a>
          </div>
          <div className="nav-right">
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Start free</Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero wrap">
          <span className="motif left" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <g fill="#0A7555" opacity=".5">
                <ellipse cx="100" cy="46" rx="20" ry="40" />
                <ellipse cx="100" cy="154" rx="20" ry="40" />
                <ellipse cx="46" cy="100" rx="40" ry="20" />
                <ellipse cx="154" cy="100" rx="40" ry="20" />
                <ellipse cx="62" cy="62" rx="16" ry="34" transform="rotate(-45 62 62)" />
                <ellipse cx="138" cy="138" rx="16" ry="34" transform="rotate(-45 138 138)" />
                <ellipse cx="138" cy="62" rx="16" ry="34" transform="rotate(45 138 62)" />
                <ellipse cx="62" cy="138" rx="16" ry="34" transform="rotate(45 62 138)" />
              </g>
              <circle cx="100" cy="100" r="26" fill="#E08A1E" />
              <circle cx="100" cy="100" r="11" fill="#B5312E" />
            </svg>
          </span>
          <span className="motif right" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <g fill="#E08A1E" opacity=".45">
                <ellipse cx="100" cy="46" rx="18" ry="36" />
                <ellipse cx="100" cy="154" rx="18" ry="36" />
                <ellipse cx="46" cy="100" rx="36" ry="18" />
                <ellipse cx="154" cy="100" rx="36" ry="18" />
              </g>
              <circle cx="100" cy="100" r="22" fill="#0A7555" />
            </svg>
          </span>

          <span className="eyebrow reveal">Event check-in for event organisers</span>
          <h1 className="reveal d1">
            Event check-in,
            <br />
            <span className="hl">QR scan. Badge printed.</span>
          </h1>
          <p className="lead reveal d2">
            Import guests from Excel, CSV or Jotform, check people in with a QR scan, and see who has arrived as it happens.
          </p>
          <div className="links-row reveal d3">
            <Link href="/signup" className="btn btn-primary">Start for free</Link>
            <a href="#pricing" className="btn">See pricing</a>
          </div>

          <span className="plane" aria-hidden="true">
            <svg viewBox="0 0 120 100">
              <path
                d="M60 6 C64 6 66 10 66 16 L66 40 L112 58 L112 66 L66 58 L66 84 L82 94 L82 100 L60 93 L38 100 L38 94 L54 84 L54 58 L8 66 L8 58 L54 40 L54 16 C54 10 56 6 60 6 Z"
                fill="#14231B"
              />
              <path d="M6 86 Q30 76 52 82" fill="none" stroke="#0A7555" strokeWidth="2" strokeDasharray="4 5" />
            </svg>
          </span>
          <span className="badge b1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
            Business travel
          </span>
          <span className="badge b2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
            Growing every event
          </span>

          <svg className="city" viewBox="0 0 1000 220" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <g fill="#0A7555" opacity=".16">
              <rect x="40" y="110" width="60" height="110" />
              <rect x="108" y="84" width="48" height="136" />
              <rect x="170" y="130" width="70" height="90" />
              <rect x="250" y="96" width="54" height="124" />
              <rect x="312" y="126" width="64" height="94" />
              <rect x="630" y="118" width="58" height="102" />
              <rect x="694" y="90" width="50" height="130" />
              <rect x="752" y="124" width="70" height="96" />
              <rect x="830" y="100" width="56" height="120" />
              <rect x="894" y="132" width="78" height="88" />
            </g>
            <path
              d="M440 220 L460 160 L470 130 L478 100 L486 70 L492 40 L496 8 L504 8 L508 40 L514 70 L522 100 L530 130 L540 160 L560 220 Z"
              fill="#0A7555"
              opacity=".85"
            />
            <g stroke="#FDE7A3" strokeWidth="2" opacity=".8">
              <line x1="462" y1="160" x2="538" y2="160" />
              <line x1="472" y1="130" x2="528" y2="130" />
              <line x1="480" y1="100" x2="520" y2="100" />
              <line x1="488" y1="70" x2="512" y2="70" />
            </g>
            <rect x="0" y="216" width="1000" height="4" fill="#0A7555" opacity=".25" />
          </svg>

          <div className="hero-shot reveal d4">
            <img className="bob" src="/home/registration.jpg" alt="A registration desk with a QR code and a smiling host" />
          </div>
        </section>

        <section className="block wrap" id="features">
          <div className="head reveal">
            <h2 className="section">Everything you need for a successful event</h2>
            <p className="section-sub">From registration to the final headcount, EventCheckin keeps your guest list in one place.</p>
          </div>
          <div className="tabs reveal d1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? ' on' : ''}`}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'check-in' && (
            <div className="panel on">
              <img src="/home/checkin.jpg" alt="A guest scanning a QR code at a check-in kiosk" />
              <div>
                <h3>Check-in at the registration desk</h3>
                <p>Put one QR banner at the hall entrance. Guests scan it, type their email or phone, and they are in. Nobody gets checked in twice.</p>
                <ul className="bullets">
                  <li>Duplicate check-ins are blocked</li>
                  <li>Works on any phone or tablet</li>
                  <li>Walk-ins fill a short form on the spot</li>
                </ul>
              </div>
            </div>
          )}
          {tab === 'badges' && (
            <div className="panel on">
              <img src="/home/booth.jpg" alt="An exhibitor booth with a screen and visitors" />
              <div>
                <h3>Badges from a laptop</h3>
                <p>Digital first, but print a badge at the desk whenever you need one.</p>
                <ul className="bullets">
                  <li>Print on demand at the desk</li>
                  <li>Name and QR on every badge</li>
                </ul>
              </div>
            </div>
          )}
          {tab === 'guests' && (
            <div className="panel on">
              <img src="/home/crowd.jpg" alt="Guests chatting in a bright event hall" />
              <div>
                <h3>All your guest lists, one list</h3>
                <p>Registrations come from everywhere. Bring them together so your team checks people in from a single place.</p>
                <ul className="bullets">
                  <li>Import Excel, CSV or Jotform</li>
                  <li>Duplicates flagged before you go live</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="wrap impress reveal">
          <img src="/home/helpdesk.jpg" alt="A help desk where staff hand out lanyards and badges" />
          <div>
            <h2>Impress your guests with hassle-free check-in</h2>
            <p>Smooth arrivals set the tone for the whole event. Staff can reissue a badge, look up a guest by email, or fix a name on the spot.</p>
            <div className="links-row" style={{ justifyContent: 'flex-start' }}>
              <Link href="/signup" className="btn btn-primary">Start free</Link>
              <a href="#" className="btn">Learn more</a>
            </div>
          </div>
        </section>

        <section className="block wrap">
          <div className="head reveal">
            <h2 className="section">Event check-in software features</h2>
            <p className="section-sub">Everything your volunteers need at the registration desk, and everything you need to see who came.</p>
          </div>
          <div className="feat-grid">
            <div className="feat reveal d1">
              <span className="ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 6v6l4 2" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </span>
              <h4>Fast check-in</h4>
              <p>A QR scan or a typed email gets a guest in within seconds.</p>
            </div>
            <div className="feat reveal d2">
              <span className="ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="4" y="5" width="16" height="11" rx="2" />
                  <path d="M2 19h20" />
                </svg>
              </span>
              <h4>Badges from a laptop</h4>
              <p>Print a badge at the desk whenever you need one.</p>
            </div>
            <div className="feat reveal d3">
              <span className="ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <h4>See no-shows live</h4>
              <p>Know who has arrived and who has not, while the event is on.</p>
            </div>
            <div className="feat reveal d1">
              <span className="ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M9 9h6M9 13h6M9 17h3" />
                </svg>
              </span>
              <h4>Excel, CSV and Jotform</h4>
              <p>Import the lists you already have.</p>
            </div>
            <div className="feat reveal d2">
              <span className="ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
                </svg>
              </span>
              <h4>Team check-in</h4>
              <p>Several volunteers can check guests in at once from their own phones.</p>
            </div>
            <div className="feat reveal d3">
              <span className="ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 19V5M4 19h16" />
                  <path d="M8 15l4-4 3 3 5-6" />
                </svg>
              </span>
              <h4>Reports</h4>
              <p>Export attendance once the event is over.</p>
            </div>
          </div>
        </section>

        <section className="block wrap">
          <div className="head reveal">
            <h2 className="section">Built for the busy entry desk</h2>
            <p className="section-sub">Guests, volunteers and organisers, all at the same registration desk.</p>
          </div>
          <div className="mosaic reveal d1">
            <img src="/home/crowd.jpg" alt="Guests in an event hall" />
            <img src="/home/booth.jpg" alt="An exhibitor booth" />
            <img src="/home/helpdesk.jpg" alt="A help desk" />
          </div>
        </section>

        <section className="wrap band reveal">
          <img src="/home/speaker.jpg" alt="A conference hall with a speaker on stage" />
          <div className="band-copy">
            <h2>Your team runs every event. EventCheckin keeps the registration queue moving.</h2>
            <p>Bring the registration list, the check-in desk and the live headcount into one place, so volunteers spend less time looking things up and more time welcoming guests.</p>
          </div>
        </section>

        <section className="block wrap" id="pricing">
          <div className="head reveal">
            <h2 className="section">Frequently asked questions</h2>
          </div>
          <div className="faq">
            {FAQS.map((f, i) => (
              <details key={f.q} className={`reveal d${i + 1}`}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta reveal">
          <span className="motif left" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <g fill="#0A7555" opacity=".35">
                <ellipse cx="100" cy="46" rx="20" ry="40" />
                <ellipse cx="100" cy="154" rx="20" ry="40" />
                <ellipse cx="46" cy="100" rx="40" ry="20" />
                <ellipse cx="154" cy="100" rx="40" ry="20" />
              </g>
              <circle cx="100" cy="100" r="22" fill="#E08A1E" />
            </svg>
          </span>
          <span className="motif right" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <g fill="#0A7555" opacity=".35">
                <ellipse cx="100" cy="46" rx="20" ry="40" />
                <ellipse cx="100" cy="154" rx="20" ry="40" />
                <ellipse cx="46" cy="100" rx="40" ry="20" />
                <ellipse cx="154" cy="100" rx="40" ry="20" />
              </g>
              <circle cx="100" cy="100" r="22" fill="#E08A1E" />
            </svg>
          </span>
          <h2>Your next event deserves a better first impression</h2>
          <p>Create a free account and check in your first guests today.</p>
          <div className="links-row">
            <Link href="/signup" className="btn btn-primary">Start for free</Link>
            <a href="#" className="btn">Book a demo</a>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <h5>Product</h5>
              <a href="#">Check-in</a>
              <a href="#">Badges</a>
              <a href="#">Guest lists</a>
              <a href="#">Reports</a>
            </div>
            <div>
              <h5>Company</h5>
              <a href="#">About</a>
              <a href="#">Contact</a>
              <a href="#">Careers</a>
            </div>
            <div>
              <h5>Resources</h5>
              <a href="#">Help</a>
              <a href="#">Guides</a>
              <a href="#">Blog</a>
            </div>
            <div>
              <h5>Legal</h5>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
          <p className="foot-bottom">EventCheckin runs in the browser. Nothing to install.</p>
        </div>
      </footer>
    </div>
  )
}
