'use client'

import { useState } from 'react'
import { supabase, generateEventId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreateEventPage() {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [capacity, setCapacity] = useState('500')
  const [generatedId, setGeneratedId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleGenerateId = () => {
    if (!name || !location || !eventDate) {
      setError('Please fill in event name, location, and date first')
      return
    }

    const id = generateEventId(name, location, new Date(eventDate))
    setGeneratedId(id)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!generatedId) {
      setError('Generate event ID first')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('Not authenticated')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profileData) {
        setError('Profile not found')
        return
      }

      // Check if event ID already exists
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('event_id', generatedId)
        .eq('organization_id', profileData.organization_id)
        .single()

      if (existingEvent) {
        setError('An event with this ID already exists. Try a different name, location, or date.')
        return
      }

      // Create event
      const { data, error: createError } = await supabase
        .from('events')
        .insert([
          {
            organization_id: profileData.organization_id,
            event_id: generatedId,
            name,
            location,
            event_date: eventDate,
            capacity: parseInt(capacity),
            status: 'upcoming',
          },
        ])
        .select('id')
        .single()

      if (createError) {
        setError('Failed to create event: ' + createError.message)
        return
      }

      router.push(`/events/${data.id}`)
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/events" style={{ color: 'var(--color-primary-green)', fontSize: '14px' }}>
          ← Back to events
        </Link>
      </div>

      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '24px' }}>Create Event</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Event Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            placeholder="e.g., Tech Fest"
            required
          />
        </div>

        <div>
          <label htmlFor="location" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Location
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input-field"
            placeholder="e.g., Bengaluru"
            required
          />
        </div>

        <div>
          <label htmlFor="eventDate" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Event Date
          </label>
          <input
            id="eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="input-field"
            required
          />
        </div>

        <div>
          <label htmlFor="capacity" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Guest Capacity
          </label>
          <input
            id="capacity"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="input-field"
            min="1"
            required
          />
        </div>

        <div style={{
          padding: '16px',
          backgroundColor: 'var(--color-neutral-light)',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            Event ID (auto-generated):
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={generatedId}
              readOnly
              className="input-field"
              placeholder="Click 'Generate ID' to create"
              style={{ flex: 1, backgroundColor: 'var(--color-white)' }}
            />
            <button
              type="button"
              onClick={handleGenerateId}
              className="btn-secondary"
            >
              Generate ID
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            Format: NAME-LOCATION-DDMONYYYY (e.g., TECHFEST-BLR-15NOV2026)
          </p>
        </div>

        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !generatedId}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  )
}
