'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ATTENDANCE_CONFIRMATIONS, INDUSTRIES, REGISTRATION_STATUSES } from '@/lib/guests'
import { COUNTRIES } from '@/lib/countries'
import { citiesFor } from '@/lib/cities'
import SearchSelect from '@/components/SearchSelect'
import { panelStyle } from './ImportPanel'

const KEEP = '__keep__'
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', fontWeight: 500 }

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
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <select id={id} value={value} onChange={(e) => set(e.target.value)} className="input-field">
        <option value={KEEP}>— Keep current —</option>
        {allowEmpty && <option value="">{allowEmpty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <form onSubmit={save} style={panelStyle}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>Edit {ids.length} attendees</h2>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Only the fields you change are updated. Names, emails and phone numbers are edited one attendee at a time.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {keepSelect('bulk-status', 'Registration status', status, setStatus, REGISTRATION_STATUSES.map((s) => ({ value: s.value, label: s.label })))}
        {keepSelect('bulk-confirmation', 'Attendance confirmation', confirmation, setConfirmation, ATTENDANCE_CONFIRMATIONS.map((s) => ({ value: s.value, label: s.label })))}
        {keepSelect('bulk-industry', 'Industry', industry, setIndustry, INDUSTRIES.map((i) => ({ value: i, label: i })), '— Clear —')}
        <div>
          <label style={{ ...labelStyle, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" checked={changeCompany} onChange={(e) => setChangeCompany(e.target.checked)} />
            Change company
          </label>
          <input aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} className="input-field" disabled={!changeCompany} maxLength={120} placeholder="Leave empty to clear" />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" checked={changeLocation} onChange={(e) => setChangeLocation(e.target.checked)} />
            Change country and city
          </label>
          <SearchSelect options={countryOptions} value={country} onChange={(v) => { setCountry(v); setCity('') }} placeholder="Search country" disabled={!changeLocation} ariaLabel="Country" />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <SearchSelect options={cityOptions} value={city} onChange={setCity} placeholder="Search or type a city" allowCustom disabled={!changeLocation} ariaLabel="City" />
        </div>
      </div>
      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : `Update ${ids.length} attendees`}</button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  )
}
