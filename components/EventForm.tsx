'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateEventId } from '@/lib/supabase'
import { COUNTRIES, countryName, detectCountry } from '@/lib/countries'
import { citiesFor } from '@/lib/cities'
import { timezoneFor } from '@/lib/timezones'
import { BANNER_RULES, LOGO_RULES } from '@/lib/images'
import { uploadImage } from '@/lib/storage'
import SearchSelect from './SearchSelect'
import ImageUpload, { PendingImage } from './ImageUpload'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

export interface EventRecord {
  id: string
  organization_id: string
  event_id: string
  name: string
  location: string
  country: string | null
  city: string | null
  event_date: string
  start_time: string | null
  timezone: string | null
  venue_type: VenueType | null
  venue_name: string | null
  venue_address: string | null
  venue_map_url: string | null
  virtual_platform: string | null
  virtual_link: string | null
  capacity: number
  banner_path: string | null
  logo_path: string | null
  archived_at?: string | null
}

const labelClass = 'mb-2 block font-medium'

export type VenueType = 'in_person' | 'virtual' | 'tba'

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
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? '')
  const [venueType, setVenueType] = useState<VenueType>(event?.venue_type ?? 'tba')
  const [venueName, setVenueName] = useState(event?.venue_name ?? '')
  const [venueAddress, setVenueAddress] = useState(event?.venue_address ?? '')
  const [venueMapUrl, setVenueMapUrl] = useState(event?.venue_map_url ?? '')
  const [virtualPlatform, setVirtualPlatform] = useState(event?.virtual_platform ?? '')
  const [virtualLink, setVirtualLink] = useState(event?.virtual_link ?? '')
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
      start_time: startTime || null,
      timezone: timezoneFor(country, city.trim()),
      venue_type: venueType,
      venue_name: venueType === 'in_person' ? venueName.trim() || null : null,
      venue_address: venueType === 'in_person' ? venueAddress.trim() || null : null,
      venue_map_url: venueType === 'in_person' ? venueMapUrl.trim() || null : null,
      virtual_platform: venueType === 'virtual' ? virtualPlatform.trim() || null : null,
      virtual_link: venueType === 'virtual' ? virtualLink.trim() || null : null,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className={labelClass}>Event Name *</label>
        <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="h-10" placeholder="e.g., Tech Fest" required maxLength={120} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <div>
          <label htmlFor="country" className={labelClass}>Country *</label>
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
          <label htmlFor="city" className={labelClass}>City *</label>
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <div>
          <label htmlFor="eventDate" className={labelClass}>Event Date *</label>
          <Input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-10" required />
        </div>
        <div>
          <label htmlFor="startTime" className={labelClass}>Start Time</label>
          <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10" />
        </div>
        <div>
          <label htmlFor="capacity" className={labelClass}>Guest Capacity</label>
          <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="h-10" min="1" required />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div>
          <label htmlFor="venueType" className={labelClass}>Venue</label>
          <NativeSelect id="venueType" className="h-10" value={venueType} onChange={(e) => setVenueType(e.target.value as VenueType)}>
            <option value="tba">To be announced</option>
            <option value="in_person">In person</option>
            <option value="virtual">Virtual</option>
          </NativeSelect>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Leave as &quot;To be announced&quot; until the venue is confirmed. Guests will see that instead.
          </p>
        </div>

        {venueType === 'in_person' && (
          <div className="grid gap-3">
            <div>
              <label htmlFor="venueName" className={labelClass}>Hotel or venue name</label>
              <Input id="venueName" value={venueName} onChange={(e) => setVenueName(e.target.value)} className="h-10" placeholder="e.g. Hilton Riyadh" />
            </div>
            <div>
              <label htmlFor="venueAddress" className={labelClass}>Address</label>
              <Input id="venueAddress" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="h-10" placeholder="Street, area" />
            </div>
            <div>
              <label htmlFor="venueMapUrl" className={labelClass}>Map link</label>
              <Input id="venueMapUrl" type="url" value={venueMapUrl} onChange={(e) => setVenueMapUrl(e.target.value)} className="h-10" placeholder="https://maps.google.com/..." />
            </div>
          </div>
        )}

        {venueType === 'virtual' && (
          <div className="grid gap-3">
            <div>
              <label htmlFor="virtualPlatform" className={labelClass}>Platform</label>
              <Input id="virtualPlatform" value={virtualPlatform} onChange={(e) => setVirtualPlatform(e.target.value)} className="h-10" placeholder="e.g. Zoom, Teams" />
            </div>
            <div>
              <label htmlFor="virtualLink" className={labelClass}>Meeting link</label>
              <Input id="virtualLink" type="url" value={virtualLink} onChange={(e) => setVirtualLink(e.target.value)} className="h-10" placeholder="https://..." />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-muted p-4">
        <p className="mb-2 text-sm text-muted-foreground">Event ID</p>
        <p className="font-mono text-lg font-semibold">
          {editing ? event.event_id : previewId || '—'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {editing
            ? 'The event ID stays the same so printed QR codes and check-in links keep working.'
            : 'Generated from name, city and date: NAME-CITY-DDMONYYYY (e.g., TECHFEST-BLR-15NOV2026).'}
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-md border border-border p-4">
        <h2 className="text-lg font-semibold">Branding</h2>
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

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? 'Saving...' : editing ? 'Save changes' : 'Create Event'}
      </Button>
    </form>
  )
}
