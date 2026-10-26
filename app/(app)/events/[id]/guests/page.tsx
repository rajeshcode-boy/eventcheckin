'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Guest,
  GuestInput,
  classifyEmails,
  completeName,
  guestEmails,
  guestsToCsvRows,
  isValidEmail,
  nameCompanyKey,
  newRegistrationId,
  toCsv,
} from '@/lib/guests'
import { COUNTRIES, Country, countryByIso, countryFromTypedNumber, detectCountry, flagEmoji, formatPhone } from '@/lib/countries'
import ImportPanel, { panelStyle } from './ImportPanel'

interface EventInfo {
  id: string
  event_id: string
  name: string
  location: string
}

const EMPTY_FORM: Record<string, string> = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  designation: '',
  company: '',
}

export default function GuestsPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [panel, setPanel] = useState<'' | 'import' | 'add'>('')

  useEffect(() => {
    loadData()
  }, [eventUuid])

  const loadData = async () => {
    setLoading(true)
    const [{ data: eventData }, { data: guestData, error: guestError }] = await Promise.all([
      supabase.from('events').select('id, event_id, name, location').eq('id', eventUuid).single(),
      supabase
        .from('registrations')
        .select('id, registration_id, source, source_id, full_name, first_name, last_name, email, phone, designation, company, company_email, created_at')
        .eq('event_id', eventUuid)
        .order('created_at', { ascending: true }),
    ])

    if (!eventData) {
      setError('Event not found')
    } else if (guestError) {
      setError('Failed to load guests: ' + guestError.message)
    } else {
      setEvent(eventData)
      setGuests((guestData ?? []) as Guest[])
    }
    setSelected(new Set())
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return guests.filter((g) => {
      if (sourceFilter && g.source !== sourceFilter) return false
      if (!q) return true
      return [g.registration_id, g.full_name, g.email, g.company_email, g.phone, g.company, g.designation]
        .some((v) => v?.toLowerCase().includes(q))
    })
  }, [guests, search, sourceFilter])

  const allFilteredSelected = filtered.length > 0 && filtered.every((g) => selected.has(g.id))

  const toggleAll = () => {
    const next = new Set(selected)
    filtered.forEach((g) => (allFilteredSelected ? next.delete(g.id) : next.add(g.id)))
    setSelected(next)
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${selected.size} attendee(s)? Their check-ins and badge prints are deleted too.`)) return
    setError('')
    const ids = [...selected]
    const { data, error: deleteError } = await supabase.from('registrations').delete().in('id', ids).select('id')

    if (deleteError) {
      setError('Delete failed: ' + deleteError.message)
    } else if (!data || data.length < ids.length) {
      setError('Some attendees could not be deleted. Only admins can delete attendees.')
    } else {
      setNotice(`Deleted ${data.length} attendee(s).`)
    }
    loadData()
  }

  const handleExport = () => {
    const rows = selected.size > 0 ? guests.filter((g) => selected.has(g.id)) : filtered
    const blob = new Blob(['﻿' + toCsv(guestsToCsvRows(rows))], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event?.event_id ?? 'attendees'}-attendees.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !event) {
    return <p>Loading attendees...</p>
  }

  if (!event) {
    return (
      <div>
        <p className="alert-error">{error}</p>
        <Link href="/events" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
          Back to events
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href={`/events/${event.id}`} style={{ color: 'var(--color-primary-green)', fontSize: '14px' }}>
          ← Back to {event.name}
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Attendee Registration</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            {event.name} • <span style={{ fontFamily: 'monospace' }}>{event.event_id}</span> • {guests.length} attendee{guests.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className={panel === 'import' ? 'btn-secondary' : 'btn-primary'} onClick={() => setPanel(panel === 'import' ? '' : 'import')}>
            {panel === 'import' ? 'Close import' : 'Import CSV/Excel'}
          </button>
          <button className="btn-secondary" onClick={() => setPanel(panel === 'add' ? '' : 'add')}>
            {panel === 'add' ? 'Close' : 'Add attendee'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert-success" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="alert-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {panel === 'import' && (
        <ImportPanel
          eventUuid={event.id}
          existing={guests}
          onDone={(message) => {
            setPanel('')
            setNotice(message)
            setError('')
            loadData()
          }}
        />
      )}

      {panel === 'add' && (
        <AddGuestForm
          eventUuid={event.id}
          eventLocation={event.location}
          existing={guests}
          onDone={(message) => {
            setPanel('')
            setNotice(message)
            setError('')
            loadData()
          }}
        />
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field"
          placeholder="Search name, email, phone, company or reg ID"
          style={{ flex: '1 1 260px' }}
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="input-field"
          style={{ flex: '0 0 160px' }}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          <option value="import">Imported</option>
          <option value="manual">Manual</option>
          <option value="walkin">Walk-in</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {selected.size > 0 ? `${selected.size} selected` : `Showing ${filtered.length} of ${guests.length}`}
        </span>
        <button className="btn-secondary" onClick={handleExport} disabled={filtered.length === 0 && selected.size === 0}>
          Export {selected.size > 0 ? 'selected' : 'shown'} (CSV)
        </button>
        <button
          className="btn-secondary"
          onClick={handleDelete}
          disabled={selected.size === 0}
          style={{ color: selected.size > 0 ? 'var(--color-error-red)' : undefined }}
        >
          Delete selected
        </button>
      </div>

      {guests.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            No attendees yet. Import a CSV or Excel file, or add attendees one by one.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <th style={cellStyle}>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all shown" />
                </th>
                <th style={cellStyle}>Reg ID</th>
                <th style={cellStyle}>Name</th>
                <th style={cellStyle}>Corporate email</th>
                <th style={cellStyle}>Personal email</th>
                <th style={cellStyle}>Phone</th>
                <th style={cellStyle}>Company</th>
                <th style={cellStyle}>Designation</th>
                <th style={cellStyle}>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={cellStyle}>
                    <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleOne(g.id)} aria-label={`Select ${g.full_name}`} />
                  </td>
                  <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{g.registration_id}</td>
                  <td style={{ ...cellStyle, fontWeight: 500 }}>{g.full_name}</td>
                  <td style={cellStyle}>{g.company_email}</td>
                  <td style={cellStyle}>{g.email}</td>
                  <td style={cellStyle}>{g.phone}</td>
                  <td style={cellStyle}>{g.company}</td>
                  <td style={cellStyle}>{g.designation}</td>
                  <td style={{ ...cellStyle, color: 'var(--color-text-secondary)' }}>{g.source}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No attendees match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const cellStyle: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' }


function AddGuestForm({
  eventUuid,
  eventLocation,
  existing,
  onDone,
}: {
  eventUuid: string
  eventLocation: string
  existing: Guest[]
  onDone: (message: string) => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [country, setCountry] = useState<Country>(() =>
    detectCountry(eventLocation, typeof navigator !== 'undefined' ? navigator.language : undefined)
  )
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (key: string, value: string) => {
    setForm({ ...form, [key]: value })
    setWarning('')
  }

  // Typing "+971 50..." switches the country and keeps only the local number
  const updatePhone = (value: string) => {
    const typed = countryFromTypedNumber(value, country.iso)
    if (typed) {
      setCountry(typed)
      update('phone', value.replace(/^\s*\+\s*/, '').replace(/\D/g, '').slice(typed.dial.length))
    } else {
      update('phone', value.replace(/[^\d\s()-]/g, ''))
    }
  }

  const sortedCountries = useMemo(() => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const raw: GuestInput = {}
    for (const key of ['first_name', 'last_name', 'designation', 'company'] as const) {
      if (form[key]?.trim()) raw[key] = form[key]!.trim()
    }
    const email = form.email?.trim().toLowerCase()
    if (email) raw.company_email = email
    const phone = formatPhone(country, form.phone ?? '')
    if (phone) raw.phone = phone
    const guest = classifyEmails(completeName(raw))

    if (!guest.first_name) {
      setError('First name is required')
      return
    }
    if (email && !isValidEmail(email)) {
      setError('Email format looks wrong')
      return
    }

    const sameEmail = email && existing.find((g) => guestEmails(g).includes(email))
    if (sameEmail) {
      setError(`${sameEmail.full_name} (${sameEmail.registration_id}) is already registered with this email.`)
      return
    }
    const key = nameCompanyKey(guest)
    const sameNameCompany = key && existing.find((g) => nameCompanyKey(g) === key)
    if (sameNameCompany && !warning) {
      setWarning(`${sameNameCompany.full_name} from ${sameNameCompany.company} is already registered (${sameNameCompany.registration_id}). Click "Add attendee" again to add anyway.`)
      return
    }

    setSaving(true)
    const taken = new Set(existing.map((g) => g.registration_id))
    const { data, error: insertError } = await supabase
      .from('registrations')
      .insert([{ ...guest, event_id: eventUuid, source: 'manual', registration_id: newRegistrationId(taken) }])
      .select('registration_id')
      .single()
    setSaving(false)

    if (insertError) {
      setError('Could not add attendee: ' + insertError.message)
      return
    }
    onDone(`Added ${guest.full_name} (${data.registration_id}).`)
  }

  const textField = (key: string, label: string, opts: { type?: string; required?: boolean; hint?: string } = {}) => (
    <div>
      <label htmlFor={`add-${key}`} style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
        {label}{opts.required ? ' *' : ''}
      </label>
      <input
        id={`add-${key}`}
        type={opts.type ?? 'text'}
        value={form[key] ?? ''}
        onChange={(e) => update(key, e.target.value)}
        className="input-field"
        required={opts.required}
      />
      {opts.hint && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{opts.hint}</p>
      )}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={panelStyle}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Add attendee</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {textField('first_name', 'First name', { required: true })}
        {textField('last_name', 'Last name')}
        {textField('email', 'Email', { type: 'email', hint: 'Corporate email preferred. Personal addresses (Gmail, Yahoo…) are saved as personal email.' })}
        <div style={{ gridColumn: 'span 1' }}>
          <label htmlFor="add-phone" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Phone
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={country.iso}
              onChange={(e) => setCountry(countryByIso(e.target.value) ?? country)}
              className="input-field"
              aria-label="Country code"
              title={country.name}
              style={{ flex: '0 0 112px', width: '112px', padding: '8px' }}
            >
              {sortedCountries.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.name} (+{c.dial})
                </option>
              ))}
            </select>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}
              >
                {flagEmoji(country.iso)} +{country.dial}
              </span>
              <input
                id="add-phone"
                type="tel"
                inputMode="tel"
                value={form.phone ?? ''}
                onChange={(e) => updatePhone(e.target.value)}
                className="input-field"
                style={{ paddingLeft: `${40 + country.dial.length * 10}px` }}
                placeholder="Mobile number"
              />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Detected from the event location. Pick another country or type a number starting with +.
          </p>
        </div>
        {textField('designation', 'Designation')}
        {textField('company', 'Company')}
      </div>
      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {warning && <div className="alert-warning" style={{ marginBottom: '16px' }}>{warning}</div>}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Adding...' : 'Add attendee'}
      </button>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        A 6-character registration ID is generated automatically.
      </p>
    </form>
  )
}
