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
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-[440px] flex-col gap-5">
        <p className="text-center text-[17px] font-bold">EventCheckin</p>
        <DigitalBadge token={token} />
        <PushNotifications mode="guest" badgeToken={token} />
      </div>
    </main>
  )
}
