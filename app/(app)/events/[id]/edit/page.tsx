'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EventForm, { EventRecord } from '@/components/EventForm'

export default function EditEventPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('events')
      .select('id, organization_id, event_id, name, location, country, city, event_date, start_time, capacity, banner_path, logo_path')
      .eq('id', eventUuid)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) setError('Event not found')
        else setEvent(data as EventRecord)
      })
  }, [eventUuid])

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ maxWidth: '640px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Edit Event</h1>
        {searchParams.get('branding') === 'failed' && (
          <div className="alert-warning" style={{ marginBottom: '16px' }}>
            The event was created, but the banner or logo could not be uploaded. Add them again below.
          </div>
        )}
        {error && <p className="alert-error">{error}</p>}
        {!event && !error && <p>Loading event...</p>}
        {event && <EventForm event={event} />}
      </div>
    </div>
  )
}
