'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EventForm, { EventRecord } from '@/components/EventForm'
import EventLifecycle from '@/components/EventLifecycle'
import { Alert } from '@/components/ui/alert'

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
    <div className="max-w-[900px]">
      <div className="max-w-[640px]">
        <h1 className="mb-6 text-[28px] font-bold">Edit Event</h1>
        {searchParams.get('branding') === 'failed' && (
          <Alert variant="warning" className="mb-4">
            The event was created, but the banner or logo could not be uploaded. Add them again below.
          </Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        {!event && !error && <p>Loading event...</p>}
        {event && <EventForm event={event} />}
        {event && (
          <div className="mt-8">
            <EventLifecycle
              eventUuid={eventUuid}
              name={event.name}
              archivedAt={event.archived_at ?? null}
              bannerPath={event.banner_path}
              logoPath={event.logo_path}
            />
          </div>
        )}
      </div>
    </div>
  )
}
