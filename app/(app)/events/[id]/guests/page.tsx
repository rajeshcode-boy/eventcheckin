'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Guest,
  GuestInput,
  guestsToCsvRows,
  isValidEmail,
  nameCompanyKey,
  newRegistrationId,
  normalizeGuestEmail,
  toCsv,
} from '@/lib/guests'
import ImportPanel, { panelStyle } from './ImportPanel'

interface EventInfo {
  id: string
  event_id: string
  name: string
}

const EMPTY_FORM: Record<string, string> = {
  full_name: '',
  email: '',
  phone: '',
  designation: '',
  company: '',
  company_email: '',
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
      supabase.from('events').select('id, event_id, name').eq('id', eventUuid).single(),
      supabase
        .from('registrations')
        .select('id, registration_id, source, source_id, full_name, email, phone, designation, company, company_email, created_at')
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
      return [g.registration_id, g.full_name, g.email, g.phone, g.company, g.designation]
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
    if (!confirm(`Delete ${selected.size} guest(s)? Their check-ins and badge prints are deleted too.`)) return
    setError('')
    const ids = [...selected]
    const { data, error: deleteError } = await supabase.from('registrations').delete().in('id', ids).select('id')

    if (deleteError) {
      setError('Delete failed: ' + deleteError.message)
    } else if (!data || data.length < ids.length) {
      setError('Some guests could not be deleted. Only admins can delete guests.')
    } else {
      setNotice(`Deleted ${data.length} guest(s).`)
    }
    loadData()
  }

  const handleExport = () => {
    const rows = selected.size > 0 ? guests.filter((g) => selected.has(g.id)) : filtered
    const blob = new Blob(['﻿' + toCsv(guestsToCsvRows(rows))], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event?.event_id ?? 'guests'}-guests.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !event) {
    return <p>Loading guests...</p>
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
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Guest List</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            {event.name} • <span style={{ fontFamily: 'monospace' }}>{event.event_id}</span> • {guests.length} guest{guests.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className={panel === 'import' ? 'btn-secondary' : 'btn-primary'} onClick={() => setPanel(panel === 'import' ? '' : 'import')}>
            {panel === 'import' ? 'Close import' : 'Import CSV/Excel'}
          </button>
          <button className="btn-secondary" onClick={() => setPanel(panel === 'add' ? '' : 'add')}>
            {panel === 'add' ? 'Close' : 'Add guest'}
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
            No guests yet. Import a CSV or Excel file, or add guests one by one.
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
                <th style={cellStyle}>Email</th>
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
                  <td style={cellStyle}>{g.email}</td>
                  <td style={cellStyle}>{g.phone}</td>
                  <td style={cellStyle}>{g.company}</td>
                  <td style={cellStyle}>{g.designation}</td>
                  <td style={{ ...cellStyle, color: 'var(--color-text-secondary)' }}>{g.source}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No guests match your search.
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
  existing,
  onDone,
}: {
  eventUuid: string
  existing: Guest[]
  onDone: (message: string) => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (key: string, value: string) => {
    setForm({ ...form, [key]: value })
    setWarning('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const guest: GuestInput = {}
    Object.entries(form).forEach(([k, v]) => {
      if (v.trim()) guest[k as keyof GuestInput] = v.trim()
    })
    if (guest.email) guest.email = normalizeGuestEmail(guest.email)
    if (guest.company_email) guest.company_email = normalizeGuestEmail(guest.company_email)

    if (!guest.full_name) {
      setError('Full name is required')
      return
    }
    if (guest.email && !isValidEmail(guest.email)) {
      setError('Email format looks wrong')
      return
    }
    if (guest.company_email && !isValidEmail(guest.company_email)) {
      setError('Company email format looks wrong')
      return
    }

    const sameEmail = guest.email && existing.find((g) => g.email && normalizeGuestEmail(g.email) === guest.email)
    if (sameEmail) {
      setError(`${sameEmail.full_name} (${sameEmail.registration_id}) is already registered with this email.`)
      return
    }
    const key = nameCompanyKey(guest)
    const sameNameCompany = key && existing.find((g) => nameCompanyKey(g) === key)
    if (sameNameCompany && !warning) {
      setWarning(`${sameNameCompany.full_name} from ${sameNameCompany.company} is already registered (${sameNameCompany.registration_id}). Click "Add guest" again to add anyway.`)
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
      setError('Could not add guest: ' + insertError.message)
      return
    }
    onDone(`Added ${guest.full_name} (${data.registration_id}).`)
  }

  const fields: { key: string; label: string; type?: string; required?: boolean }[] = [
    { key: 'full_name', label: 'Full name', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'designation', label: 'Designation' },
    { key: 'company', label: 'Company' },
    { key: 'company_email', label: 'Company email', type: 'email' },
  ]

  return (
    <form onSubmit={handleSubmit} style={panelStyle}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Add guest</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`add-${f.key}`} style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              {f.label}{f.required ? ' *' : ''}
            </label>
            <input
              id={`add-${f.key}`}
              type={f.type ?? 'text'}
              value={form[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="input-field"
              required={f.required}
            />
          </div>
        ))}
      </div>
      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {warning && <div className="alert-warning" style={{ marginBottom: '16px' }}>{warning}</div>}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Adding...' : 'Add guest'}
      </button>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        A 6-character registration ID is generated automatically.
      </p>
    </form>
  )
}
