'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useEventRole } from '@/components/EventRoleContext'
import { landingPathFor } from '@/lib/permissions'

// Entry point from the events list: sends each person to the part of the event their role is for.
// The event layout has already loaded the role by the time this renders.
export default function EnterEventPage() {
  const router = useRouter()
  const params = useParams()
  const role = useEventRole()

  useEffect(() => {
    router.replace(`/events/${params.id as string}${landingPathFor(role)}`)
  }, [router, params.id, role])

  return <p className="text-sm text-muted-foreground">Opening event...</p>
}
