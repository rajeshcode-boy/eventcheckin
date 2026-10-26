'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateEventId } from '@/lib/supabase'
import { COUNTRIES, countryName, detectCountry } from '@/lib/countries'
import { citiesFor } from '@/lib/cities'
import { BANNER_RULES, LOGO_RULES } from '@/lib/images'
import { uploadImage } from '@/lib/storage'
import SearchSelect from './SearchSelect'
import ImageUpload, { PendingImage } from './ImageUpload'

export interface EventRecord {
  id: string
  organization_id: string
  event_id: string
  name: string
  location: string
  country: string | null
  city: string | null
  event_date: string
  capacity: number
  banner_path: string | null
  logo_path: string | null
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', fontWeight: 500 }

// Create (no `event`) or edit an event. The event ID is fixed after creation
// because it is printed in QR codes and check-in links.
export default function EventForm({ event }: { event?: EventRecord }) {
  const router = useRouter()
  const editing = !!event
  const [name, setName] = useState(event?.name ?? '')
  const [country, setCountry] = useState(
    event?.country ?? (event ? '' : detectCountry('', typeof navigator !== 'undefined' ? navigator.language : undefined).iso)
  )
  const [city, setCity] = useState(event?.city ?? (event && !event.country ? event.location : '') ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? '')
  const [capacity, setCapacity] = useState(String(event?.capacity ?? 500))
  const [bannerPath, setBannerPath] = useState(event?.banner_path ?? null)
  const [logoPath, setLogoPath] = useState(event?.logo_path ?? null)
  const [pendingBanner, setPendingBanner] = useState<PendingImage | null>(null)
  const [pendingLogo, setPendingLogo] = useState<PendingImage | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const countryOptions = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.iso, label: c.name })),
    []
  )
  const cityOptions = useMemo(() => citiesFor(country).map((c) => ({ value: c, label: c })), [country])

  const previewId = name && city && eventDate ? generateEventId(name, city, new Date(eventDate)) : ''

  const saveBranding = async (column: 'banner_path' | 'logo_path', path: string | null) => {
    if (!event) return false
    const { error: updateError } = await supabase.from('events').update({ [column]: path, updated_at: new Date().toISOString() }).eq('id', event.id)
    if (updateError) return false
    if (column === 'banner_path') setBannerPath(path)
    else setLogoPath(path)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!name.trim() || !country || !city.trim() || !eventDate) {
      setError('Fill in event name, country, city and date.')
      return
    }
    const cap = parseInt(capacity, 10)
    if (!Number.isFinite(cap) || cap < 1) {
      setError('Capacity must be at least 1.')
      return
    }

    const fields = {
      name: name.trim(),
      country,
      city: city.trim(),
      location: `${city.trim()}, ${countryName(country)}`,
      event_date: eventDate,
      capacity: cap,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    try {
      if (editing) {
        const { error: updateError } = await supabase.from('events').update(fields).eq('id', event.id)
        if (updateError) throw new Error(updateError.message)
        setNotice('Event saved.')
        router.refresh()
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = user
        ? await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
        : { data: null }
      if (!profile) throw new Error('Your profile could not be loaded. Log in again.')

      const { data: created, error: createError } = await supabase
        .from('events')
        .insert([{ ...fields, organization_id: profile.organization_id, event_id: previewId, status: 'upcoming' }])
        .select('id')
        .single()
      if (createError) {
        // Event IDs are unique across all organizers (they appear in the public check-in URL)
        throw new Error(
          createError.code === '23505'
            ? 'This event ID is already taken. Add something to the name (e.g. "Tech Fest 2") or change the date.'
            : 'Failed to create event: ' + createError.message
        )
      }

      // Branding chosen before the event existed is uploaded now
      const folder = `${profile.organization_id}/events/${created.id}`
      const branding: Record<string, string> = {}
      try {
        if (pendingBanner) branding.banner_path = await uploadImage('branding', folder, 'banner', pendingBanner.file, pendingBanner.type)
        if (pendingLogo) branding.logo_path = await uploadImage('branding', folder, 'logo', pendingLogo.file, pendingLogo.type)
        if (Object.keys(branding).length) await supabase.from('events').update(branding).eq('id', created.id)
      } catch {
        router.push(`/events/${created.id}/edit?branding=failed`)
        return
      }
      router.push(`/events/${created.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label htmlFor="name" style={labelStyle}>Event Name *</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g., Tech Fest" required maxLength={120} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <label htmlFor="country" style={labelStyle}>Country *</label>
          <SearchSelect
            id="country"
            options={countryOptions}
            value={country}
            onChange={(v) => {
              // Switching country clears the city; picking one for an older event keeps its city
              if (country && v !== country) setCity('')
              setCountry(v)
            }}
            placeholder="Search country"
            required
          />
        </div>
        <div>
          <label htmlFor="city" style={labelStyle}>City *</label>
          <SearchSelect
            id="city"
            options={cityOptions}
            value={city}
            onChange={setCity}
            placeholder={cityOptions.length ? 'Search or type a city' : 'Type a city'}
            allowCustom
            required
            disabled={!country}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <label htmlFor="eventDate" style={labelStyle}>Event Date *</label>
          <input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input-field" required />
        </div>
        <div>
          <label htmlFor="capacity" style={labelStyle}>Guest Capacity</label>
          <input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="input-field" min="1" required />
        </div>
      </div>

      <div style={{ padding: '16px', backgroundColor: 'var(--color-neutral-light)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Event ID</p>
        <p style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 600 }}>
          {editing ? event.event_id : previewId || '—'}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          {editing
            ? 'The event ID stays the same so printed QR codes and check-in links keep working.'
            : 'Generated from name, city and date: NAME-CITY-DDMONYYYY (e.g., TECHFEST-BLR-15NOV2026).'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Branding</h2>
        {editing ? (
          <>
            <ImageUpload
              mode="saved" label="Event banner" shape="banner" rules={BANNER_RULES} bucket="branding"
              folder={`${event.organization_id}/events/${event.id}`} kind="banner" path={bannerPath}
              onSave={(p) => saveBranding('banner_path', p)}
              hint="Wide image shown at the top of the public check-in page (about 4:1, e.g. 1600×400)."
            />
            <ImageUpload
              mode="saved" label="Event logo" shape="logo" rules={LOGO_RULES} bucket="branding"
              folder={`${event.organization_id}/events/${event.id}`} kind="logo" path={logoPath}
              onSave={(p) => saveBranding('logo_path', p)}
              hint="Shown in the event header and on badges. Falls back to your organization logo."
            />
          </>
        ) : (
          <>
            <ImageUpload
              mode="pending" label="Event banner" shape="banner" rules={BANNER_RULES} pending={pendingBanner} onPendingChange={setPendingBanner}
              hint="Wide image shown at the top of the public check-in page (about 4:1, e.g. 1600×400)."
            />
            <ImageUpload
              mode="pending" label="Event logo" shape="logo" rules={LOGO_RULES} pending={pendingLogo} onPendingChange={setPendingLogo}
              hint="Shown in the event header and on badges. Falls back to your organization logo."
            />
          </>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}

      <button type="submit" disabled={saving} className="btn-primary" style={{ width: '100%' }}>
        {saving ? 'Saving...' : editing ? 'Save changes' : 'Create Event'}
      </button>
    </form>
  )
}
