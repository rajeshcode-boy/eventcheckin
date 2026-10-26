'use client'

import Link from 'next/link'
import EventForm from '@/components/EventForm'

export default function CreateEventPage() {
  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/events" style={{ color: 'var(--color-primary-green)', fontSize: '14px' }}>
          ← Back to events
        </Link>
      </div>

      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Create Event</h1>
      <EventForm />
    </div>
  )
}
