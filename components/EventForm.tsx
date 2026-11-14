'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateEventId } from '@/lib/supabase'
import { COUNTRIES, countryName, detectCountry } from '@/lib/countries'
import { citiesFor } from '@/lib/cities'
import { timezoneFor } from '@/lib/timezones'
import { BANNER_RULES, LOGO_RULES } from '@/lib/images'
import { publicImageUrl, uploadImage } from '@/lib/storage'
import SearchSelect from './SearchSelect'
import ImageUpload, { PendingImage } from './ImageUpload'
import EventPassSimulator from './events/EventPassSimulator'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Video,
  Globe,
  Users,
  Image as ImageIcon,
  Copy,
  Check,
  Loader2,
  Ticket,
  FileText,
} from 'lucide-react'

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

const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground uppercase tracking-wide'

export type VenueType = 'in_person' | 'virtual' | 'tba'

const CAPACITY_PRESETS = [100, 250, 500, 1000, 2500]

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
  const [copiedId, setCopiedId] = useState(false)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form')

  const countryOptions = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.iso, label: c.name })),
    []
  )
  const cityOptions = useMemo(() => citiesFor(country).map((c) => ({ value: c, label: c })), [country])

  const previewId = name && city && eventDate ? generateEventId(name, city, new Date(eventDate)) : ''
  const effectiveEventId = editing ? event.event_id : previewId

  const detectedTimezone = useMemo(() => {
    if (!country) return null
    return timezoneFor(country, city.trim())
  }, [country, city])

  const bannerPreviewUrl = editing
    ? bannerPath
      ? publicImageUrl('branding', bannerPath)
      : null
    : pendingBanner?.previewUrl ?? null

  const logoPreviewUrl = editing
    ? logoPath
      ? publicImageUrl('branding', logoPath)
      : null
    : pendingLogo?.previewUrl ?? null

  const copyEventId = () => {
    if (!effectiveEventId) return
    navigator.clipboard.writeText(effectiveEventId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

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
      setError('Please fill in event name, country, city, and event date.')
      return
    }
    const cap = parseInt(capacity, 10)
    if (!Number.isFinite(cap) || cap < 1) {
      setError('Guest capacity must be at least 1.')
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
        setNotice('Event saved successfully.')
        router.refresh()
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = user
        ? await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
        : { data: null }
      if (!profile) throw new Error('Your profile could not be loaded. Please log in again.')

      const { data: created, error: createError } = await supabase
        .from('events')
        .insert([{ ...fields, organization_id: profile.organization_id, event_id: previewId, status: 'upcoming' }])
        .select('id')
        .single()
      if (createError) {
        throw new Error(
          createError.code === '23505'
            ? 'This event ID is already taken. Add a number to the name (e.g. "Tech Fest 2") or change the date.'
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
    <div className="w-full">
      {/* Mobile Mode Switcher */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-card p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
            mobileTab === 'form'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText size={14} />
          <span>Event Details</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all',
            mobileTab === 'preview'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Ticket size={14} />
          <span>Live Simulator</span>
        </button>
      </div>

      {/* 2-Column Desktop Grid Layout */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* LEFT COLUMN: Creation & Settings Form */}
        <div
          className={cn(
            'flex flex-col gap-6 lg:col-span-7',
            mobileTab === 'preview' && 'hidden lg:flex'
          )}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* CARD 1: Event Essentials */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-2.5 pb-3 border-b border-border/70">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    1. Event Essentials
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Core event identity and expected audience size
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="name" className={labelClass}>
                      Event Name *
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {name.length}/120
                    </span>
                  </div>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 text-sm"
                    placeholder="e.g., Annual Tech Summit 2026"
                    required
                    maxLength={120}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This appears prominently on attendee passes, kiosk screens, and invitation links.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="country" className={labelClass}>
                      Country *
                    </label>
                    <SearchSelect
                      id="country"
                      options={countryOptions}
                      value={country}
                      onChange={(v) => {
                        if (country && v !== country) setCity('')
                        setCountry(v)
                      }}
                      placeholder="Select country"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className={labelClass}>
                      City *
                    </label>
                    <SearchSelect
                      id="city"
                      options={cityOptions}
                      value={city}
                      onChange={setCity}
                      placeholder={cityOptions.length ? 'Search or type city' : 'Type city'}
                      allowCustom
                      required
                      disabled={!country}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="capacity" className={labelClass}>
                      Guest Capacity *
                    </label>
                    <div className="hidden sm:flex items-center gap-1.5">
                      {CAPACITY_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCapacity(String(preset))}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border',
                            capacity === String(preset)
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <Users size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="capacity"
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="h-10 pl-9 text-sm"
                      min="1"
                      placeholder="e.g. 500"
                      required
                    />
                  </div>
                  <div className="flex sm:hidden items-center gap-1.5 mt-2 flex-wrap">
                    {CAPACITY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCapacity(String(preset))}
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border',
                          capacity === String(preset)
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: Date & Schedule */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-2.5 pb-3 border-b border-border/70">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    2. Date & Schedule
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Event timing and automatic timezone synchronization
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="eventDate" className={labelClass}>
                    Event Date *
                  </label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="startTime" className={labelClass}>
                    Start Time
                  </label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {detectedTimezone && (
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Globe size={13} className="text-primary shrink-0" />
                  <span>
                    Detected Timezone: <strong className="text-foreground">{detectedTimezone}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* CARD 3: Venue & Location */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-2.5 pb-3 border-b border-border/70">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    3. Venue & Location
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Choose how attendees will attend your event
                  </p>
                </div>
              </div>

              {/* Segmented Option Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setVenueType('in_person')}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all',
                    venueType === 'in_person'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground font-semibold'
                      : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Building2
                      size={16}
                      className={venueType === 'in_person' ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <span className="text-sm font-semibold text-foreground">In-Person</span>
                  </div>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Physical hall or center
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setVenueType('virtual')}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all',
                    venueType === 'virtual'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground font-semibold'
                      : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Video
                      size={16}
                      className={venueType === 'virtual' ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <span className="text-sm font-semibold text-foreground">Virtual</span>
                  </div>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Online video meeting
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setVenueType('tba')}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all',
                    venueType === 'tba'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground font-semibold'
                      : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Clock
                      size={16}
                      className={venueType === 'tba' ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <span className="text-sm font-semibold text-foreground">To Be Announced</span>
                  </div>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Confirm address later
                  </span>
                </button>
              </div>

              {/* Dynamic Venue Fields */}
              <div className="mt-4">
                {venueType === 'in_person' && (
                  <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 animate-in fade-in-50 duration-200">
                    <div>
                      <label htmlFor="venueName" className={labelClass}>
                        Hotel or Venue Name
                      </label>
                      <Input
                        id="venueName"
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                        className="h-10 text-sm"
                        placeholder="e.g. Hilton Riyadh or Grand Expo Hall"
                      />
                    </div>
                    <div>
                      <label htmlFor="venueAddress" className={labelClass}>
                        Street Address
                      </label>
                      <Input
                        id="venueAddress"
                        value={venueAddress}
                        onChange={(e) => setVenueAddress(e.target.value)}
                        className="h-10 text-sm"
                        placeholder="e.g. King Fahd Road, Al Olaya"
                      />
                    </div>
                    <div>
                      <label htmlFor="venueMapUrl" className={labelClass}>
                        Google Maps Link (Optional)
                      </label>
                      <Input
                        id="venueMapUrl"
                        type="url"
                        value={venueMapUrl}
                        onChange={(e) => setVenueMapUrl(e.target.value)}
                        className="h-10 text-sm"
                        placeholder="https://maps.google.com/..."
                      />
                    </div>
                  </div>
                )}

                {venueType === 'virtual' && (
                  <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4 animate-in fade-in-50 duration-200">
                    <div>
                      <label htmlFor="virtualPlatform" className={labelClass}>
                        Platform
                      </label>
                      <Input
                        id="virtualPlatform"
                        value={virtualPlatform}
                        onChange={(e) => setVirtualPlatform(e.target.value)}
                        className="h-10 text-sm"
                        placeholder="e.g. Zoom, Microsoft Teams, Google Meet"
                      />
                    </div>
                    <div>
                      <label htmlFor="virtualLink" className={labelClass}>
                        Meeting Link
                      </label>
                      <Input
                        id="virtualLink"
                        type="url"
                        value={virtualLink}
                        onChange={(e) => setVirtualLink(e.target.value)}
                        className="h-10 text-sm"
                        placeholder="https://zoom.us/j/..."
                      />
                    </div>
                  </div>
                )}

                {venueType === 'tba' && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-700 dark:text-amber-400">
                    <p className="leading-relaxed">
                      💡 Attendees will see <strong>&quot;Venue to be announced&quot;</strong> on their passes and invitation confirmations until you finalize the address.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 4: Visual Branding */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-2.5 pb-3 border-b border-border/70">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ImageIcon size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    4. Studio Branding
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Banner artwork and brand logo for passes and kiosks
                  </p>
                </div>
              </div>

              {editing ? (
                <div className="flex flex-col gap-5">
                  <ImageUpload
                    mode="saved"
                    label="Event Banner"
                    shape="banner"
                    rules={BANNER_RULES}
                    bucket="branding"
                    folder={`${event.organization_id}/events/${event.id}`}
                    kind="banner"
                    path={bannerPath}
                    onSave={(p) => saveBranding('banner_path', p)}
                    hint="Wide header banner (about 4:1 ratio, e.g. 1600×400px). Shown on passes & portals."
                  />
                  <ImageUpload
                    mode="saved"
                    label="Event Logo"
                    shape="logo"
                    rules={LOGO_RULES}
                    bucket="branding"
                    folder={`${event.organization_id}/events/${event.id}`}
                    kind="logo"
                    path={logoPath}
                    onSave={(p) => saveBranding('logo_path', p)}
                    hint="Square logo (1:1 ratio, min 64×64px). Shown in header and entrance badges."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <ImageUpload
                    mode="pending"
                    label="Event Banner"
                    shape="banner"
                    rules={BANNER_RULES}
                    pending={pendingBanner}
                    onPendingChange={setPendingBanner}
                    hint="Wide header banner (about 4:1 ratio, e.g. 1600×400px). Shown on passes & portals."
                  />
                  <ImageUpload
                    mode="pending"
                    label="Event Logo"
                    shape="logo"
                    rules={LOGO_RULES}
                    pending={pendingLogo}
                    onPendingChange={setPendingLogo}
                    hint="Square logo (1:1 ratio, min 64×64px). Shown in header and entrance badges."
                  />
                </div>
              )}
            </div>

            {/* CARD 5: Event ID & URL Slug Preview */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Event ID & Public Check-in Slug
                </span>
                {effectiveEventId && (
                  <button
                    type="button"
                    onClick={copyEventId}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    {copiedId ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-foreground sm:text-lg">
                  {effectiveEventId || '—'}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {editing
                  ? 'The event ID stays permanent so already-printed physical badges, QR codes, and kiosk bookmarks never break.'
                  : 'Automatically generated as NAME-CITY-DDMONYYYY for instant kiosk lookups and clear badge labeling.'}
              </p>
            </div>

            {/* Error & Notice Alerts */}
            {error && <Alert variant="error">{error}</Alert>}
            {notice && <Alert variant="success">{notice}</Alert>}

            {/* Form Submit CTA Button */}
            <Button
              type="submit"
              className="h-12 w-full text-base font-bold shadow-md shadow-primary/20 transition-all hover:shadow-lg"
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-5 animate-spin" />
                  <span>{editing ? 'Saving Changes...' : 'Creating Event Workspace...'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles size={18} />
                  <span>{editing ? 'Save Changes' : 'Create Event & Launch Workspace'}</span>
                </div>
              )}
            </Button>
          </form>
        </div>

        {/* RIGHT COLUMN: Live Studio Simulator (Sticky on Desktop) */}
        <div
          className={cn(
            'lg:col-span-5 lg:sticky lg:top-6 lg:self-start',
            mobileTab === 'form' && 'hidden lg:block'
          )}
        >
          <EventPassSimulator
            name={name}
            city={city}
            country={country}
            eventDate={eventDate}
            startTime={startTime}
            venueType={venueType}
            venueName={venueName}
            venueAddress={venueAddress}
            virtualPlatform={virtualPlatform}
            capacity={capacity}
            bannerUrl={bannerPreviewUrl}
            logoUrl={logoPreviewUrl}
            eventId={effectiveEventId}
          />
        </div>
      </div>
    </div>
  )
}
