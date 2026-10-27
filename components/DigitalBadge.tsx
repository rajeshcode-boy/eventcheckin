'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatTime } from '@/lib/time'
import { BadgeImages, badgeDataFor, defaultDesign, parseDesign } from '@/lib/badgeDesign'
import BadgePreview from '@/components/BadgePreview'

interface BadgeRow {
  status: string
  registration_id: string
  first_name: string | null
  last_name: string | null
  full_name: string
  designation: string | null
  company: string | null
  country: string | null
  city: string | null
  industry: string | null
  registration_status: string | null
  checked_in_at: string | null
  collected_at: string | null
  event_name: string
  event_location: string
  event_date: string
  event_country: string | null
  event_city: string | null
  event_logo_path: string | null
  org_logo_path: string | null
  design: unknown
}

const BADGE_WIDTH_PX = 320

// The attendee's badge, drawn with the event's printed badge design. Stays on screen until the guest leaves.
export default function DigitalBadge({ token }: { token: string }) {
  const [row, setRow] = useState<BadgeRow | null | 'missing'>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('public_badge', { p_token: token }).then(({ data, error: rpcError }) => {
      if (rpcError) setError("Couldn't load your badge. Try again in a moment.")
      else if (!data || data.length === 0) setRow('missing')
      else setRow(data[0] as BadgeRow)
    })
  }, [token])

  if (error) return <div className="alert-error" role="alert">{error}</div>
  if (row === null) return <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading your badge...</p>
  if (row === 'missing') return <div className="alert-error" role="alert">This badge link is not valid.</div>

  const design = row.design ? parseDesign(row.design) : defaultDesign()
  const images: BadgeImages = { eventLogoPath: row.event_logo_path, orgLogoPath: row.org_logo_path }
  const data = badgeDataFor(
    {
      full_name: row.full_name,
      first_name: row.first_name,
      last_name: row.last_name,
      company: row.company,
      designation: row.designation,
      country: row.country,
      city: row.city,
      industry: row.industry,
      registration_status: row.registration_status,
      registration_id: row.registration_id,
    },
    { name: row.event_name, event_date: row.event_date, location: row.event_location, city: row.event_city, country: row.event_country }
  )

  const status = row.collected_at
    ? { tone: 'success', text: `Badge collected at ${formatTime(row.collected_at)}. Enjoy the event.` }
    : row.checked_in_at
      ? { tone: 'success', text: 'Checked in. Show this badge at the registration desk to collect your printed badge.' }
      : { tone: 'warning', text: 'Not checked in yet. Check in at the entrance first.' }

  return (
    <section aria-label="Your badge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: `${BADGE_WIDTH_PX}px`, maxWidth: '100%', overflow: 'hidden', borderRadius: '12px', boxShadow: 'var(--shadow-card)' }}>
        <BadgePreview design={design} data={data} images={images} scale={BADGE_WIDTH_PX / design.widthMm} />
      </div>
      <div
        className={status.tone === 'success' ? 'alert-success' : 'alert-warning'}
        role="status"
        style={{ width: '100%', textAlign: 'center', fontSize: '16px' }}
      >
        {status.text}
      </div>
    </section>
  )
}
