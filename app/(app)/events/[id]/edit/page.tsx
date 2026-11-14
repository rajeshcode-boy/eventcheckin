'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import EventForm, { EventRecord } from '@/components/EventForm'
import EventLifecycle from '@/components/EventLifecycle'
import { Alert } from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Settings2 } from 'lucide-react'

export default function EditEventPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('events')
      .select('id, organization_id, event_id, name, location, country, city, event_date, start_time, timezone, venue_type, venue_name, venue_address, venue_map_url, virtual_platform, virtual_link, capacity, banner_path, logo_path, archived_at')
      .eq('id', eventUuid)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) setError('Event not found')
        else setEvent(data as EventRecord)
      })
  }, [eventUuid])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb Navigation */}
      <div className="mb-5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link href="/events" className="transition-colors hover:text-foreground">
                Events
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {event ? (
              <>
                <BreadcrumbItem>
                  <Link href={`/events/${eventUuid}`} className="transition-colors hover:text-foreground">
                    {event.name}
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : null}
            <BreadcrumbItem>
              <BreadcrumbPage>Settings & Details</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings2 size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Edit Event Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Update your event configuration, branding, and check-in parameters.
          </p>
        </div>
      </div>

      {searchParams.get('branding') === 'failed' && (
        <Alert variant="warning" className="mb-6">
          The event was created, but the banner or logo could not be uploaded. Add them again below.
        </Alert>
      )}

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {!event && !error && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading event settings...
        </div>
      )}

      {event && (
        <div className="flex flex-col gap-10">
          <EventForm event={event} />
          
          <div className="border-t border-border/80 pt-8">
            <EventLifecycle
              eventUuid={eventUuid}
              name={event.name}
              archivedAt={event.archived_at ?? null}
              bannerPath={event.banner_path}
              logoPath={event.logo_path}
            />
          </div>
        </div>
      )}
    </div>
  )
}
