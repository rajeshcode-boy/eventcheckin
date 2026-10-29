'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ATTENDANCE_CONFIRMATIONS, INDUSTRIES, REGISTRATION_STATUSES } from '@/lib/guests'
import { COUNTRIES } from '@/lib/countries'
import { citiesFor } from '@/lib/cities'
import SearchSelect from '@/components/SearchSelect'
import { cn } from '@/lib/utils'
import { panelClass } from './ImportPanel'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

const KEEP = '__keep__'
const labelClass = 'mb-2 block font-medium'

// Sets fields that can safely share one value across several attendees.
// Names, emails and phones are per person, so they are edited one at a time.
export default function BulkEditPanel({ ids, onDone, onCancel }: { ids: string[]; onDone: (message: string) => void; onCancel: () => void }) {
  const [company, setCompany] = useState('')
  const [changeCompany, setChangeCompany] = useState(false)
  const [changeLocation, setChangeLocation] = useState(false)
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [industry, setIndustry] = useState(KEEP)
  const [status, setStatus] = useState(KEEP)
  const [confirmation, setConfirmation] = useState(KEEP)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const countryOptions = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.iso, label: c.name })),
    []
  )
  const cityOptions = useMemo(() => citiesFor(country).map((c) => ({ value: c, label: c })), [country])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const changes: Record<string, string | null> = {}
    if (changeCompany) changes.company = company.trim() || null
    if (changeLocation) {
      changes.country = country || null
      changes.city = city.trim() || null
    }
    if (industry !== KEEP) changes.industry = industry || null
    if (status !== KEEP) changes.registration_status = status
    if (confirmation !== KEEP) changes.attendance_confirmation = confirmation
    if (Object.keys(changes).length === 0) {
      setError('Choose at least one field to change.')
      return
    }

    setSaving(true)
    const { data, error: updateError } = await supabase
      .from('registrations')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select('id')
    setSaving(false)
    if (updateError) {
      setError('Could not save: ' + updateError.message)
      return
    }
    if ((data?.length ?? 0) < ids.length) {
      setError(`Only ${data?.length ?? 0} of ${ids.length} attendees could be updated.`)
      return
    }
    onDone(`Updated ${ids.length} attendee(s).`)
  }

  const keepSelect = (id: string, label: string, value: string, set: (v: string) => void, options: { value: string; label: string }[], allowEmpty?: string) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <NativeSelect id={id} className="h-10" value={value} onChange={(e) => set(e.target.value)}>
        <option value={KEEP}>— Keep current —</option>
        {allowEmpty && <option value="">{allowEmpty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </div>
  )

  return (
    <form onSubmit={save} className={panelClass}>
      <h2 className="mb-1 text-xl font-semibold">Edit {ids.length} attendees</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Only the fields you change are updated. Names, emails and phone numbers are edited one attendee at a time.
      </p>
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {keepSelect('bulk-status', 'Registration status', status, setStatus, REGISTRATION_STATUSES.map((s) => ({ value: s.value, label: s.label })))}
        {keepSelect('bulk-confirmation', 'Attendance confirmation', confirmation, setConfirmation, ATTENDANCE_CONFIRMATIONS.map((s) => ({ value: s.value, label: s.label })))}
        {keepSelect('bulk-industry', 'Industry', industry, setIndustry, INDUSTRIES.map((i) => ({ value: i, label: i })), '— Clear —')}
        <div>
          <label className={cn(labelClass, 'flex items-center gap-2')}>
            <input type="checkbox" checked={changeCompany} onChange={(e) => setChangeCompany(e.target.checked)} />
            Change company
          </label>
          <Input aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} className="h-10" disabled={!changeCompany} maxLength={120} placeholder="Leave empty to clear" />
        </div>
        <div>
          <label className={cn(labelClass, 'flex items-center gap-2')}>
            <input type="checkbox" checked={changeLocation} onChange={(e) => setChangeLocation(e.target.checked)} />
            Change country and city
          </label>
          <SearchSelect options={countryOptions} value={country} onChange={(v) => { setCountry(v); setCity('') }} placeholder="Search country" disabled={!changeLocation} ariaLabel="Country" />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <SearchSelect options={cityOptions} value={city} onChange={setCity} placeholder="Search or type a city" allowCustom disabled={!changeLocation} ariaLabel="City" />
        </div>
      </div>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : `Update ${ids.length} attendees`}</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  )
}
