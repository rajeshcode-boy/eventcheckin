'use client'

import { useParams } from 'next/navigation'
import DigitalBadge from '@/components/DigitalBadge'
import PushNotifications from '@/components/PushNotifications'

// Guest's own badge page, opened from the check-in screen or the link in the registration email.
// No login. Stays open until the guest closes it.
export default function PublicBadgePage() {
  const params = useParams()
  const token = params.token as string

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-neutral-light)', padding: '32px 16px' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ fontWeight: 700, fontSize: '17px', textAlign: 'center' }}>EventCheckin</p>
        <DigitalBadge token={token} />
        <PushNotifications mode="guest" badgeToken={token} />
      </div>
    </main>
  )
}
