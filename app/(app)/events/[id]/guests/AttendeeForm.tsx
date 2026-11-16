'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ATTENDANCE_CONFIRMATIONS,
  Guest,
  GuestInput,
  INDUSTRIES,
  REGISTRATION_STATUSES,
  classifyEmails,
  completeName,
  guestEmails,
  isValidEmail,
  nameCompanyKey,
  newRegistrationId,
} from '@/lib/guests'
import { COUNTRIES } from '@/lib/countries'
import { citiesFor } from '@/lib/cities'
import SearchSelect from '@/components/SearchSelect'
import PhoneInput from '@/components/PhoneInput'
import { panelClass } from './ImportPanel'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { CustomSelect } from '@/components/ui/custom-select'

interface Props {
  eventUuid: string
  eventCountry: string
  existing: Guest[]
  // Omit to add a new attendee
  attendee?: Guest
  onDone: (message: string) => void
  onCancel?: () => void
}

const labelClass = 'mb-2 block font-medium'
const isPreset = (industry: string) => (INDUSTRIES as readonly string[]).includes(industry)

export default function AttendeeForm({ eventUuid, eventCountry, existing, attendee, onDone, onCancel }: Props) {
  const editing = !!attendee
  const [firstName, setFirstName] = useState(attendee?.first_name ?? attendee?.full_name ?? '')
  const [lastName, setLastName] = useState(attendee?.last_name ?? '')
  // Add: one email, sorted by domain. Edit: both emails shown so either can be corrected.
  const [email, setEmail] = useState('')
  const [companyEmail, setCompanyEmail] = useState(attendee?.company_email ?? '')
  const [personalEmail, setPersonalEmail] = useState(attendee?.email ?? '')
  const [phone, setPhone] = useState(attendee?.phone ?? '')
  const [designation, setDesignation] = useState(attendee?.designation ?? '')
  const [company, setCompany] = useState(attendee?.company ?? '')
  const [country, setCountry] = useState(attendee ? attendee.country ?? '' : eventCountry)
  const [city, setCity] = useState(attendee?.city ?? '')
  const savedIndustry = attendee?.industry ?? ''
  const [industryChoice, setIndustryChoice] = useState(savedIndustry && !isPreset(savedIndustry) ? 'Other' : savedIndustry)
  const [industryOther, setIndustryOther] = useState(savedIndustry && !isPreset(savedIndustry) ? savedIndustry : '')
  const [status, setStatus] = useState(attendee?.registration_status ?? 'registered')
  const [confirmation, setConfirmation] = useState(attendee?.attendance_confirmation ?? 'not_confirmed')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [saving, setSaving] = useState(false)

  const countryOptions = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.iso, label: c.name })),
    []
  )
  const cityOptions = useMemo(() => citiesFor(country).map((c) => ({ value: c, label: c })), [country])
  const others = existing.filter((g) => g.id !== attendee?.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const raw: GuestInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      designation: designation.trim() || undefined,
      company: company.trim() || undefined,
      phone: phone.trim() || undefined,
      country: country || undefined,
      city: city.trim() || undefined,
      industry: (industryChoice === 'Other' ? industryOther.trim() || 'Other' : industryChoice) || undefined,
      registration_status: status,
      attendance_confirmation: confirmation,
    }
    if (editing) {
      raw.company_email = companyEmail.trim().toLowerCase() || undefined
      raw.email = personalEmail.trim().toLowerCase() || undefined
    } else if (email.trim()) {
      raw.company_email = email.trim().toLowerCase()
    }
    const guest = editing ? completeName(raw) : classifyEmails(completeName(raw))

    if (!guest.first_name) {
      setError('First name is required.')
      return
    }
    const badEmail = guestEmails(guest).find((x) => !isValidEmail(x))
    if (badEmail) {
      setError(`Email format looks wrong: ${badEmail}`)
      return
    }
    const sameEmail = guestEmails(guest).map((x) => others.find((g) => guestEmails(g).includes(x))).find(Boolean)
    if (sameEmail) {
      setError(`${sameEmail.full_name} (${sameEmail.registration_id}) is already registered with this email.`)
      return
    }
    const key = nameCompanyKey(guest)
    const sameNameCompany = key && others.find((g) => nameCompanyKey(g) === key)
    if (sameNameCompany && !warning) {
      setWarning(`${sameNameCompany.full_name} from ${sameNameCompany.company} is already registered (${sameNameCompany.registration_id}). Click save again to continue anyway.`)
      return
    }

    // Cleared fields are saved as empty (null), not left unchanged
    const record = {
      first_name: guest.first_name,
      last_name: guest.last_name ?? null,
      full_name: guest.full_name,
      email: guest.email ?? null,
      company_email: guest.company_email ?? null,
      phone: guest.phone ?? null,
      designation: guest.designation ?? null,
      company: guest.company ?? null,
      country: guest.country ?? null,
      city: guest.city ?? null,
      industry: guest.industry ?? null,
      registration_status: status,
      attendance_confirmation: confirmation,
    }

    setSaving(true)
    if (editing) {
      const { data, error: updateError } = await supabase
        .from('registrations')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', attendee.id)
        .select('id')
      setSaving(false)
      if (updateError || !data?.length) {
        setError('Could not save: ' + (updateError?.message ?? 'you may not have permission to edit this attendee.'))
        return
      }
      onDone(`Saved changes to ${guest.full_name}.`)
      return
    }

    const taken = new Set(existing.map((g) => g.registration_id))
    const { data, error: insertError } = await supabase
      .from('registrations')
      .insert([{ ...record, event_id: eventUuid, source: 'manual', registration_id: newRegistrationId(taken) }])
      .select('registration_id')
      .single()
    setSaving(false)
    if (insertError) {
      setError('Could not add attendee: ' + insertError.message)
      return
    }
    onDone(`Added ${guest.full_name} (${data.registration_id}).`)
  }

  const text = (id: string, label: string, value: string, set: (v: string) => void, opts: { type?: string; required?: boolean; hint?: string } = {}) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}{opts.required ? ' *' : ''}</label>
      <Input
        id={id}
        type={opts.type ?? 'text'}
        value={value}
        onChange={(e) => {
          set(e.target.value)
          setWarning('')
        }}
        className="h-10"
        required={opts.required}
        maxLength={opts.type === 'email' ? 254 : 120}
      />
      {opts.hint && <p className="mt-1 text-xs text-muted-foreground">{opts.hint}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className={panelClass}>
      <h2 className="mb-4 text-xl font-semibold">
        {editing ? `Edit ${attendee.full_name}` : 'Add attendee'}
        {editing && <span className="ml-2 font-mono text-sm text-muted-foreground">{attendee.registration_id}</span>}
      </h2>
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {text('att-first', 'First name', firstName, setFirstName, { required: true })}
        {text('att-last', 'Last name', lastName, setLastName)}
        {editing ? (
          <>
            {text('att-corp-email', 'Corporate email', companyEmail, setCompanyEmail, { type: 'email' })}
            {text('att-personal-email', 'Personal email', personalEmail, setPersonalEmail, { type: 'email' })}
          </>
        ) : (
          text('att-email', 'Email', email, setEmail, { type: 'email', hint: 'Corporate email preferred. Personal addresses (Gmail, Yahoo…) are saved as personal email.' })
        )}
        <div>
          <label htmlFor="att-phone" className={labelClass}>Phone</label>
          <PhoneInput id="att-phone" value={phone} onChange={setPhone} defaultCountryIso={country || eventCountry || 'IN'} />
        </div>
        {text('att-company', 'Company', company, setCompany)}
        {text('att-designation', 'Designation', designation, setDesignation)}
        <div>
          <label htmlFor="att-country" className={labelClass}>Country</label>
          <SearchSelect
            id="att-country"
            options={countryOptions}
            value={country}
            onChange={(v) => {
              if (country && v !== country) setCity('')
              setCountry(v)
            }}
            placeholder="Search country"
          />
        </div>
        <div>
          <label htmlFor="att-city" className={labelClass}>City</label>
          <SearchSelect id="att-city" options={cityOptions} value={city} onChange={setCity} placeholder="Search or type a city" allowCustom />
        </div>
        <div>
          <label htmlFor="att-industry" className={labelClass}>Industry</label>
          <CustomSelect
            id="att-industry"
            value={industryChoice}
            onChange={(v) => setIndustryChoice(v)}
            options={[{ value: '', label: '— Not set —' }, ...INDUSTRIES.map((i) => ({ value: i, label: i }))]}
          />
          {industryChoice === 'Other' && (
            <Input
              aria-label="Other industry"
              value={industryOther}
              onChange={(e) => setIndustryOther(e.target.value)}
              className="mt-2 h-10"
              placeholder="Type the industry"
              maxLength={80}
            />
          )}
        </div>
        <div>
          <label htmlFor="att-status" className={labelClass}>Registration status</label>
          <CustomSelect
            id="att-status"
            value={status}
            onChange={(v) => setStatus(v)}
            options={REGISTRATION_STATUSES.map((s) => ({
              value: s.value,
              label: s.label,
              dot:
                s.value === 'approved' || s.value === 'registered'
                  ? 'bg-emerald-500'
                  : s.value === 'pending'
                  ? 'bg-amber-500'
                  : s.value === 'rejected'
                  ? 'bg-rose-500'
                  : 'bg-slate-400',
            }))}
          />
        </div>
        <div>
          <label htmlFor="att-confirmation" className={labelClass}>Attendance confirmation</label>
          <CustomSelect
            id="att-confirmation"
            value={confirmation}
            onChange={(v) => setConfirmation(v)}
            options={ATTENDANCE_CONFIRMATIONS.map((s) => ({
              value: s.value,
              label: s.label,
              dot:
                s.value === 'confirmed'
                  ? 'bg-emerald-500'
                  : s.value === 'maybe'
                  ? 'bg-amber-500'
                  : 'bg-slate-400',
            }))}
          />
        </div>
      </div>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {warning && <Alert variant="warning" className="mb-4">{warning}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Add attendee'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
      {!editing && (
        <p className="mt-2 text-sm text-muted-foreground">
          A 6-character registration ID is generated automatically. Attendance confirmation is separate from check-in.
        </p>
      )}
    </form>
  )
}
