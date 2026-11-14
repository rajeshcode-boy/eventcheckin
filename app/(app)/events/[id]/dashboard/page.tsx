'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardRedirect() {
  const params = useParams()
  const router = useRouter()
  const eventUuid = params.id as string

  useEffect(() => {
    if (eventUuid) {
      router.replace(`/events/${eventUuid}/desk`)
    }
  }, [eventUuid, router])

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
      <h2 className="text-base font-semibold">Redirecting to Live Gate Station...</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Live telemetry and arrival stream are now unified into the Gate Station.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        render={<Link href={`/events/${eventUuid}/desk`} />}
        nativeButton={false}
      >
        Click here if not redirected automatically
      </Button>
    </div>
  )
}
