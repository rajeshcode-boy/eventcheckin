'use client'

import Link from 'next/link'
import EventForm from '@/components/EventForm'

export default function CreateEventPage() {
  return (
    <div className="max-w-[640px]">
      <div className="mb-6">
        <Link href="/events" className="text-sm text-primary">
          ← Back to events
        </Link>
      </div>

      <h1 className="mb-6 text-[28px] font-bold">Create Event</h1>
      <EventForm />
    </div>
  )
}
