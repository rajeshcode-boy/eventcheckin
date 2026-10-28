'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ATTENDANCE_CONFIRMATIONS,
  Guest,
  REGISTRATION_STATUSES,
  attendanceConfirmationLabel,
  guestsToCsvRows,
  registrationStatusLabel,
  toCsv,
} from '@/lib/guests'
import { countryName, detectCountry } from '@/lib/countries'
import ImportPanel from './ImportPanel'
import AttendeeForm from './AttendeeForm'
import BulkEditPanel from './BulkEditPanel'

interface EventInfo {
  id: string
  event_id: string
  name: string
  location: string
  country: string | null
}

type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'
type Panel = '' | 'import' | 'add' | 'bulk-edit'

const EMPTY_FILTERS = { country: '', city: '', industry: '', status: '', confirmation: '', source: '' }
const PAGE_SIZES = [25, 50, 100]

const ATTENDEE_COLUMNS =
  'id, registration_id, source, source_id, full_name, first_name, last_name, email, company_email, phone, designation, company, ' +
  'country, city, industry, registration_status, attendance_confirmation, created_at'

const STATUS_COLORS: Record<string, string> = {
  approved: 'var(--color-primary)',
  registered: 'var(--color-primary)',
  pending: 'var(--color-amber-warning)',
  rejected: 'var(--color-error-red)',
  cancelled: 'var(--color-error-red)',
  confirmed: 'var(--color-primary)',
  maybe: 'var(--color-amber-warning)',
  not_confirmed: 'var(--color-text-secondary)',
}

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function GuestsPage() {
  const params = useParams()
  const eventUuid = params.id as string
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [moreFilters, setMoreFilters] = useState(false)
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('created_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [panel, setPanel] = useState<Panel>('')
  const [editing, setEditing] = useState<Guest | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: eventData }, { data: guestData, error: guestError }, { data: checkinData }] = await Promise.all([
      supabase.from('events').select('id, event_id, name, location, country').eq('id', eventUuid).single(),
      supabase.from('registrations').select(ATTENDEE_COLUMNS).eq('event_id', eventUuid).order('created_at', { ascending: true }),
      supabase.from('checkins').select('registration_id').eq('event_id', eventUuid),
    ])

    if (!eventData) {
      setError('Event not found')
    } else if (guestError) {
      setError('Failed to load attendees: ' + guestError.message)
    } else {
      setEvent(eventData)
      const list = (guestData ?? []) as unknown as Guest[]
      setGuests(list)
      setCheckedIn(new Set((checkinData ?? []).map((c) => c.registration_id as string)))
      // Drop selections of attendees that no longer exist
      setSelected((prev) => new Set([...prev].filter((id) => list.some((g) => g.id === id))))
    }
    setLoading(false)
  }, [eventUuid])

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(loadData, 300)
  }, [loadData])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel(`guests-${eventUuid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins', filter: `event_id=eq.${eventUuid}` }, scheduleReload)
      .subscribe()
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      supabase.removeChannel(channel)
    }
  }, [eventUuid, loadData, scheduleReload])

  // Filter choices come from the attendees' actual values
  const options = useMemo(() => {
    const uniq = (values: (string | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b))
    return {
      countries: uniq(guests.map((g) => g.country)).map((iso) => ({ value: iso, label: countryName(iso) || iso })),
      cities: uniq(guests.filter((g) => !filters.country || g.country === filters.country).map((g) => g.city)),
      industries: uniq(guests.map((g) => g.industry)),
    }
  }, [guests, filters.country])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = guests.filter((g) => {
      if (filters.country && g.country !== filters.country) return false
      if (filters.city && g.city !== filters.city) return false
      if (filters.industry && g.industry !== filters.industry) return false
      if (filters.status && g.registration_status !== filters.status) return false
      if (filters.confirmation && g.attendance_confirmation !== filters.confirmation) return false
      if (filters.source && g.source !== filters.source) return false
      if (!q) return true
      return [g.registration_id, g.full_name, g.email, g.company_email, g.phone, g.company].some((v) => v?.toLowerCase().includes(q))
    })
    const byName = (a: Guest, b: Guest) => a.full_name.localeCompare(b.full_name)
    const byDate = (a: Guest, b: Guest) => (a.created_at ?? '').localeCompare(b.created_at ?? '')
    const sorters: Record<SortKey, (a: Guest, b: Guest) => number> = {
      created_desc: (a, b) => byDate(b, a),
      created_asc: byDate,
      name_asc: byName,
      name_desc: (a, b) => byName(b, a),
    }
    return [...list].sort(sorters[sort])
  }, [guests, search, filters, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const filtersActive = !!search || Object.values(filters).some(Boolean)

  // Back to page 1 whenever the result set changes shape
  useEffect(() => {
    setPage(1)
  }, [search, filters, sort, pageSize])

  const setFilter = (key: keyof typeof EMPTY_FILTERS, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'country' ? { city: '' } : {}) }))

  const clearFilters = () => {
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  const pageAllSelected = pageRows.length > 0 && pageRows.every((g) => selected.has(g.id))
  const togglePage = () => {
    const next = new Set(selected)
    pageRows.forEach((g) => (pageAllSelected ? next.delete(g.id) : next.add(g.id)))
    setSelected(next)
  }
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const finish = (message: string) => {
    setPanel('')
    setEditing(null)
    setNotice(message)
    setError('')
    loadData()
  }

  const handleDelete = async () => {
    const count = selected.size
    if (!confirm(`Delete ${count} attendee(s)?\n\nTheir check-ins and badge print history are deleted too. This cannot be undone.`)) return
    setError('')
    setNotice('')
    const ids = [...selected]
    const { data, error: deleteError } = await supabase.from('registrations').delete().in('id', ids).eq('event_id', eventUuid).select('id')

    if (deleteError) {
      setError('Delete failed: ' + deleteError.message)
    } else if (!data || data.length < ids.length) {
      setError(`${data?.length ?? 0} of ${count} attendee(s) deleted. Only admins can delete attendees.`)
    } else {
      setNotice(`Deleted ${data.length} attendee(s).`)
    }
    loadData()
  }

  const handleExport = () => {
    // Selected attendees (even ones hidden by the current filters), otherwise everything shown
    const rows = selected.size > 0 ? guests.filter((g) => selected.has(g.id)) : filtered
    const blob = new Blob(['﻿' + toCsv(guestsToCsvRows(rows))], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event?.event_id ?? 'attendees'}-attendees${selected.size > 0 ? '-selected' : ''}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleEditSelected = () => {
    if (selected.size === 1) {
      setEditing(guests.find((g) => selected.has(g.id)) ?? null)
      setPanel('')
    } else {
      setEditing(null)
      setPanel('bulk-edit')
    }
  }

  if (loading && !event) return <p>Loading attendees...</p>

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

  const eventCountry = event.country ?? detectCountry(event.location).iso

  return (
    <div style={{ maxWidth: '1400px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Guests</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
            {guests.length} guest{guests.length === 1 ? '' : 's'} for {event.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className={panel === 'import' ? 'btn-secondary' : 'btn-primary'} onClick={() => setPanel(panel === 'import' ? '' : 'import')}>
            {panel === 'import' ? 'Close import' : 'Import CSV/Excel'}
          </button>
          <button className="btn-secondary" onClick={() => { setEditing(null); setPanel(panel === 'add' ? '' : 'add') }}>
            {panel === 'add' ? 'Close' : 'Add guest'}
          </button>
        </div>
      </div>

      {notice && <div className="alert-success" style={{ marginBottom: '16px' }}>{notice}</div>}
      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {panel === 'import' && <ImportPanel eventUuid={event.id} existing={guests} onDone={finish} />}
      {panel === 'add' && <AttendeeForm eventUuid={event.id} eventCountry={eventCountry} existing={guests} onDone={finish} onCancel={() => setPanel('')} />}
      {panel === 'bulk-edit' && <BulkEditPanel ids={[...selected]} onDone={finish} onCancel={() => setPanel('')} />}

      {/* Search, filters and sort */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field"
          placeholder="Search name, email, phone, company or reg ID"
          aria-label="Search attendees"
          style={{ flex: '1 1 280px' }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-field" style={{ flex: '0 0 210px' }} aria-label="Sort attendees">
          <option value="created_desc">Newest registrations first</option>
          <option value="created_asc">Oldest registrations first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>
      </div>
      {/* The two most-used filters stay visible; the rest sit behind "More filters" */}
      {(() => {
        const hiddenActive = [filters.country, filters.city, filters.industry, filters.source].filter(Boolean).length
        return (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
              <FilterSelect label="Registration status" value={filters.status} onChange={(v) => setFilter('status', v)} options={REGISTRATION_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
              <FilterSelect label="Attendance" value={filters.confirmation} onChange={(v) => setFilter('confirmation', v)} options={ATTENDANCE_CONFIRMATIONS.map((s) => ({ value: s.value, label: s.label }))} />
              <button type="button" className="btn-secondary" aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)}>
                {moreFilters ? 'Fewer filters' : `More filters${hiddenActive ? ` (${hiddenActive})` : ''}`}
              </button>
            </div>
            {moreFilters && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <FilterSelect label="Country" value={filters.country} onChange={(v) => setFilter('country', v)} options={options.countries} />
                <FilterSelect label="City" value={filters.city} onChange={(v) => setFilter('city', v)} options={options.cities.map((c) => ({ value: c, label: c }))} />
                <FilterSelect label="Industry" value={filters.industry} onChange={(v) => setFilter('industry', v)} options={options.industries.map((i) => ({ value: i, label: i }))} />
                <FilterSelect label="Source" value={filters.source} onChange={(v) => setFilter('source', v)} options={[{ value: 'import', label: 'Imported' }, { value: 'manual', label: 'Manual' }, { value: 'walkin', label: 'Walk-in' }]} />
              </div>
            )}
          </>
        )
      })()}

      {/* Selection actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', minHeight: '44px' }}>
        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {selected.size > 0 ? `${selected.size} selected` : `Showing ${filtered.length} of ${guests.length}`}
        </span>
        {filtersActive && (
          <button className="btn-secondary" onClick={clearFilters}>Clear filters</button>
        )}
        {selected.size > 0 ? (
          <>
            <button className="btn-secondary" onClick={handleExport}>Export selected (CSV)</button>
            <button className="btn-secondary" onClick={handleEditSelected}>{selected.size === 1 ? 'Edit' : `Edit ${selected.size}`}</button>
            <button className="btn-secondary" onClick={handleDelete} style={{ color: 'var(--color-error-red)', borderColor: 'var(--color-error-red)' }}>
              Delete {selected.size}
            </button>
            <button className="btn-secondary" onClick={() => setSelected(new Set())}>Clear selection</button>
            {selected.size < filtered.length && (
              <button className="btn-secondary" onClick={() => setSelected(new Set(filtered.map((g) => g.id)))}>
                Select all {filtered.length} shown
              </button>
            )}
          </>
        ) : (
          <button className="btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>Export shown (CSV)</button>
        )}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <AttendeeForm
            key={editing.id}
            eventUuid={event.id}
            eventCountry={eventCountry}
            existing={guests}
            attendee={editing}
            onDone={finish}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {guests.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>No attendees yet. Import a CSV or Excel file, or add attendees one by one.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={cellStyle}>
                    <input type="checkbox" checked={pageAllSelected} onChange={togglePage} aria-label="Select all on this page" />
                  </th>
                  <th style={cellStyle}>Attendee</th>
                  <th style={cellStyle}>Email</th>
                  <th style={cellStyle}>Phone</th>
                  <th style={cellStyle}>Company</th>
                  <th style={cellStyle}>Country</th>
                  <th style={cellStyle}>City</th>
                  <th style={cellStyle}>Industry</th>
                  <th style={cellStyle}>Registration</th>
                  <th style={cellStyle}>Attendance</th>
                  <th style={cellStyle}>Registered</th>
                  <th style={cellStyle}>Check-in</th>
                  <th style={cellStyle}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((g) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: selected.has(g.id) ? 'var(--color-neutral-light)' : undefined }}>
                    <td style={cellStyle}>
                      <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleOne(g.id)} aria-label={`Select ${g.full_name}`} />
                    </td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 600 }}>{g.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <span style={{ fontFamily: 'monospace' }}>{g.registration_id}</span>
                        {g.designation ? ` • ${g.designation}` : ''} • {g.source}
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <div>{g.company_email || g.email}</div>
                      {g.company_email && g.email && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{g.email}</div>}
                    </td>
                    <td style={cellStyle}>{g.phone}</td>
                    <td style={cellStyle}>{g.company}</td>
                    <td style={cellStyle}>{countryName(g.country)}</td>
                    <td style={cellStyle}>{g.city}</td>
                    <td style={cellStyle}>{g.industry}</td>
                    <td style={cellStyle}><Pill value={g.registration_status} label={registrationStatusLabel(g.registration_status)} /></td>
                    <td style={cellStyle}><Pill value={g.attendance_confirmation} label={attendanceConfirmationLabel(g.attendance_confirmation)} /></td>
                    <td style={cellStyle}>{formatDate(g.created_at)}</td>
                    <td style={{ ...cellStyle, color: checkedIn.has(g.id) ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                      {checkedIn.has(g.id) ? 'Checked in' : '—'}
                    </td>
                    <td style={cellStyle}>
                      <button className="btn-secondary" onClick={() => { setPanel(''); setEditing(g) }} style={{ minHeight: '32px', padding: '4px 12px' }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={13} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      No attendees match your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
            <label style={{ fontSize: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              Rows per page
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="input-field" style={{ width: '90px' }}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn-secondary" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Previous</button>
              <span style={{ fontSize: '14px' }}>Page {currentPage} of {pageCount}</span>
              <button className="btn-secondary" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const cellStyle: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'top' }

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field" aria-label={`Filter by ${label.toLowerCase()}`}>
      <option value="">{label}: all</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Pill({ value, label }: { value?: string; label: string }) {
  const color = (value && STATUS_COLORS[value]) || 'var(--color-text-secondary)'
  return (
    <span style={{ display: 'inline-block', fontSize: '12px', fontWeight: 600, color, border: `1px solid ${color}`, borderRadius: '999px', padding: '2px 8px' }}>
      {label}
    </span>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px 16px', overflowY: 'auto' }}
    >
      <div style={{ width: '100%', maxWidth: '900px', backgroundColor: 'var(--color-white)', borderRadius: '8px' }}>{children}</div>
    </div>
  )
}
