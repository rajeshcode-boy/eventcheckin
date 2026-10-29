'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/components/ConfirmDialog'
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
import BulkEditPanel from './BulkEditPanel'
import GuestDrawer from './GuestDrawer'
import { useEventRole } from '@/components/EventRoleContext'
import { canManageGuests } from '@/lib/permissions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

interface EventInfo {
  id: string
  event_id: string
  name: string
  location: string
  country: string | null
}

type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'
type Panel = '' | 'import' | 'bulk-edit'
type DrawerMode = 'view' | 'edit' | 'add'

const EMPTY_FILTERS = { country: '', city: '', industry: '', status: '', confirmation: '', source: '' }
const PAGE_SIZES = [25, 50, 100]

const ATTENDEE_COLUMNS =
  'id, registration_id, source, source_id, full_name, first_name, last_name, email, company_email, phone, designation, company, ' +
  'country, city, industry, registration_status, attendance_confirmation, created_at'

const TONE = {
  good: 'border-primary text-primary',
  warn: 'border-amber-500 text-amber-600',
  bad: 'border-destructive text-destructive',
  quiet: 'border-muted-foreground text-muted-foreground',
}
const STATUS_TONES: Record<string, string> = {
  approved: TONE.good,
  registered: TONE.good,
  pending: TONE.warn,
  rejected: TONE.bad,
  cancelled: TONE.bad,
  confirmed: TONE.good,
  maybe: TONE.warn,
  not_confirmed: TONE.quiet,
}

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function GuestsPage() {
  const { confirm, dialog } = useConfirm()
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
  // The guest drawer: one guest to view or edit, or a blank form to add
  const [openId, setOpenId] = useState<string | null>(null)
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)
  const role = useEventRole()
  const canEdit = canManageGuests(role)

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

  const openGuest = (id: string, mode: DrawerMode = 'view') => {
    setOpenId(id)
    setDrawerMode(mode)
  }
  const openAdd = () => {
    setOpenId(null)
    setDrawerMode('add')
  }
  const closeDrawer = useCallback(() => {
    setOpenId(null)
    setDrawerMode(null)
  }, [])

  const finish = (message: string) => {
    setPanel('')
    setNotice(message)
    setError('')
    loadData()
  }

  // From the drawer: a saved edit goes back to the details, a newly added guest closes it
  const drawerChanged = (message?: string) => {
    if (drawerMode === 'add') closeDrawer()
    else setDrawerMode('view')
    finish(message ?? '')
  }

  const deleteGuests = async (ids: string[]) => {
    const count = ids.length
    if (!(await confirm({ title: `Delete ${count} attendee(s)?`, description: 'Their check-ins and badge print history are deleted too. This cannot be undone.', confirmLabel: 'Delete', destructive: true }))) return
    setError('')
    setNotice('')
    const { data, error: deleteError } = await supabase.from('registrations').delete().in('id', ids).eq('event_id', eventUuid).select('id')

    if (deleteError) {
      setError('Delete failed: ' + deleteError.message)
    } else if (!data || data.length < ids.length) {
      setError(`${data?.length ?? 0} of ${count} attendee(s) deleted. Only admins can delete attendees.`)
    } else {
      setNotice(`Deleted ${data.length} attendee(s).`)
    }
    if (openId && ids.includes(openId)) closeDrawer()
    loadData()
  }
  const handleDelete = () => deleteGuests([...selected])

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
      openGuest([...selected][0]!, 'edit')
    } else {
      setPanel('bulk-edit')
    }
  }

  if (loading && !event) return <p>Loading attendees...</p>

  if (!event) {
    return (
      <div className="grid gap-4">
        <Alert variant="error">{error}</Alert>
        <Button className="w-fit" render={<Link href="/events" />} nativeButton={false}>Back to events</Button>
      </div>
    )
  }

  const eventCountry = event.country ?? detectCountry(event.location).iso
  const openGuestRow = guests.find((g) => g.id === openId) ?? null
  const drawerOpen = drawerMode !== null && (drawerMode === 'add' || openGuestRow !== null)
  // With the drawer docked beside the table, show only the columns that still fit
  const compact = drawerOpen
  const cell = 'whitespace-nowrap px-3 py-2.5 align-top'

  return (
    <>
    {dialog}
    <div className={cn('max-w-[1400px]', drawerOpen && 'grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
    <div className="min-w-0">

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-[28px] font-bold">Guests</h1>
          <p className="text-[15px] text-muted-foreground">
            {guests.length} guest{guests.length === 1 ? '' : 's'} for {event.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canEdit && <Button onClick={() => setPanel('import')}>Import CSV/Excel</Button>}
          {canEdit && <Button variant="outline" onClick={openAdd}>Add guest</Button>}
        </div>
      </div>

      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {panel === 'import' && (
        <Modal onClose={() => setPanel('')} label="Import attendees">
          <ImportPanel eventUuid={event.id} existing={guests} onDone={finish} />
        </Modal>
      )}
      {panel === 'bulk-edit' && (
        <Modal onClose={() => setPanel('')} label="Edit selected attendees">
          <BulkEditPanel ids={[...selected]} onDone={finish} onCancel={() => setPanel('')} />
        </Modal>
      )}

      {/* Search, filters and sort */}
      <div className="mb-3 flex flex-wrap gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-[280px] flex-1"
          placeholder="Search name, email, phone, company or reg ID"
          aria-label="Search attendees"
        />
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 flex-1 basis-[180px]" aria-label="Sort attendees">
          <option value="created_desc">Newest registrations first</option>
          <option value="created_asc">Oldest registrations first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </NativeSelect>
      </div>
      {/* The two most-used filters stay visible; the rest sit behind "More filters" */}
      {(() => {
        const hiddenActive = [filters.country, filters.city, filters.industry, filters.source].filter(Boolean).length
        return (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <FilterSelect label="Registration status" value={filters.status} onChange={(v) => setFilter('status', v)} options={REGISTRATION_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
              <FilterSelect label="Attendance" value={filters.confirmation} onChange={(v) => setFilter('confirmation', v)} options={ATTENDANCE_CONFIRMATIONS.map((s) => ({ value: s.value, label: s.label }))} />
              <Button type="button" variant="outline" aria-expanded={moreFilters} onClick={() => setMoreFilters(!moreFilters)}>
                {moreFilters ? 'Fewer filters' : `More filters${hiddenActive ? ` (${hiddenActive})` : ''}`}
              </Button>
            </div>
            {moreFilters && (
              <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
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
      <div className="mb-3 flex min-h-11 flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {selected.size > 0 ? `${selected.size} selected` : `Showing ${filtered.length} of ${guests.length}`}
        </span>
        {filtersActive && (
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
        )}
        {selected.size > 0 ? (
          <>
            <Button variant="outline" onClick={handleExport}>Export selected (CSV)</Button>
            <Button variant="outline" onClick={handleEditSelected}>{selected.size === 1 ? 'Edit' : `Edit ${selected.size}`}</Button>
            <Button variant="outline" className="border-destructive text-destructive" onClick={handleDelete}>
              Delete {selected.size}
            </Button>
            <Button variant="outline" onClick={() => setSelected(new Set())}>Clear selection</Button>
            {selected.size < filtered.length && (
              <Button variant="outline" onClick={() => setSelected(new Set(filtered.map((g) => g.id)))}>
                Select all {filtered.length} shown
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>Export shown (CSV)</Button>
        )}
      </div>

      {guests.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center">
          <p className="text-muted-foreground">No attendees yet. Import a CSV or Excel file, or add attendees one by one.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={cell}>
                    <input type="checkbox" className="accent-primary" checked={pageAllSelected} onChange={togglePage} aria-label="Select all on this page" />
                  </th>
                  <th className={cell}>Attendee</th>
                  {!compact && <th className={cell}>Email</th>}
                  {!compact && <th className={cell}>Phone</th>}
                  {!compact && <th className={cell}>Company</th>}
                  {!compact && <th className={cell}>Country</th>}
                  {!compact && <th className={cell}>City</th>}
                  {!compact && <th className={cell}>Industry</th>}
                  <th className={cell}>Registration</th>
                  {!compact && <th className={cell}>Attendance</th>}
                  {!compact && <th className={cell}>Registered</th>}
                  <th className={cell}>Check-in</th>
                  {!compact && <th className={cell}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => openGuest(g.id)}
                    className={cn('cursor-pointer border-b border-border', g.id === openId ? 'bg-accent' : selected.has(g.id) && 'bg-muted')}
                  >
                    <td className={cell} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-primary" checked={selected.has(g.id)} onChange={() => toggleOne(g.id)} aria-label={`Select ${g.full_name}`} />
                    </td>
                    <td className={cell}>
                      <div className="font-semibold">{g.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{g.registration_id}</span>
                        {g.designation ? ` • ${g.designation}` : ''} • {g.source}
                      </div>
                    </td>
                    {!compact && (
                      <>
                        <td className={cell}>
                          <div>{g.company_email || g.email}</div>
                          {g.company_email && g.email && <div className="text-xs text-muted-foreground">{g.email}</div>}
                        </td>
                        <td className={cell}>{g.phone}</td>
                        <td className={cell}>{g.company}</td>
                        <td className={cell}>{countryName(g.country)}</td>
                        <td className={cell}>{g.city}</td>
                        <td className={cell}>{g.industry}</td>
                      </>
                    )}
                    <td className={cell}><Pill value={g.registration_status} label={registrationStatusLabel(g.registration_status)} /></td>
                    {!compact && (
                      <>
                        <td className={cell}><Pill value={g.attendance_confirmation} label={attendanceConfirmationLabel(g.attendance_confirmation)} /></td>
                        <td className={cell}>{formatDate(g.created_at)}</td>
                      </>
                    )}
                    <td className={cn(cell, checkedIn.has(g.id) ? 'text-primary' : 'text-muted-foreground')}>
                      {checkedIn.has(g.id) ? 'Checked in' : '—'}
                    </td>
                    {!compact && (
                      <td className={cell} onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <Button variant="outline" size="sm" onClick={() => openGuest(g.id, 'edit')}>
                            Edit
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={compact ? 4 : 13} className={cn(cell, 'text-center text-muted-foreground')}>
                      No attendees match your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              Rows per page
              <NativeSelect value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-10 w-[90px]">
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </NativeSelect>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Previous</Button>
              <span className="text-sm">Page {currentPage} of {pageCount}</span>
              <Button variant="outline" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
    {drawerOpen && (
      <GuestDrawer
        eventUuid={event.id}
        eventCountry={eventCountry}
        guests={guests}
        guest={drawerMode === 'add' ? null : openGuestRow}
        mode={drawerMode!}
        checkedIn={!!openGuestRow && checkedIn.has(openGuestRow.id)}
        onMode={(m) => setDrawerMode(m)}
        onClose={closeDrawer}
        onChanged={drawerChanged}
        onDelete={(id) => deleteGuests([id])}
      />
    )}
    </div>
    </>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} className="h-10 flex-1 basis-[160px]" aria-label={`Filter by ${label.toLowerCase()}`}>
      <option value="">{label}: all</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </NativeSelect>
  )
}

function Pill({ value, label }: { value?: string; label: string }) {
  const tone = (value && STATUS_TONES[value]) || TONE.quiet
  return (
    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-semibold', tone)}>
      {label}
    </span>
  )
}

function Modal({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
    >
      <div className="w-full max-w-[900px] rounded-lg bg-background">{children}</div>
    </div>
  )
}
