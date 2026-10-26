'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  DuplicateConflict,
  GUEST_FIELDS,
  Guest,
  GuestField,
  GuestInput,
  Resolution,
  allowedResolutions,
  autoMapColumns,
  findDuplicates,
  mappingHasName,
  newRegistrationId,
  normalizeHeader,
  planImport,
  rowsToGuests,
} from '@/lib/guests'

export const panelStyle: React.CSSProperties = {
  padding: '16px',
  border: '1px solid var(--color-border)',
  borderRadius: '6px',
  marginBottom: '24px',
}

const MAPPING_STORAGE_KEY = 'eventcheckin.columnMapping'
const MAX_ROWS = 5000
const INSERT_BATCH = 200

const RESOLUTION_LABELS: Record<Resolution, string> = {
  first: 'Keep first',
  second: 'Keep second',
  both: 'Keep both',
}

function loadRememberedMapping(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAPPING_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveRememberedMapping(headers: string[], mapping: (GuestField | '')[]) {
  try {
    const saved = loadRememberedMapping()
    headers.forEach((h, i) => {
      if (normalizeHeader(h)) saved[normalizeHeader(h)] = mapping[i] ?? ''
    })
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Storage unavailable (private window); mapping just isn't remembered
  }
}

export default function ImportPanel({
  eventUuid,
  existing,
  onDone,
}: {
  eventUuid: string
  existing: Guest[]
  onDone: (message: string) => void
}) {
  const [stage, setStage] = useState<'file' | 'map' | 'review'>('file')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<(GuestField | '')[]>([])
  const [guests, setGuests] = useState<GuestInput[]>([])
  const [conflicts, setConflicts] = useState<DuplicateConflict[]>([])
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
      if (!sheet) {
        setError('This file has no sheets.')
        return
      }
      const table = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
      const [headerRow, ...dataRows] = table.map((r) => r.map((c) => String(c ?? '')))

      if (!headerRow || headerRow.every((h) => !h.trim())) {
        setError('The first row must contain column headers (e.g. Name, Email, Phone).')
        return
      }
      const nonEmpty = dataRows.filter((r) => r.some((c) => c.trim()))
      if (nonEmpty.length === 0) {
        setError('No attendee rows found below the header row.')
        return
      }
      if (nonEmpty.length > MAX_ROWS) {
        setError(`This file has ${nonEmpty.length} rows. The limit is ${MAX_ROWS} per import.`)
        return
      }

      setFileName(file.name)
      setHeaders(headerRow)
      setRows(nonEmpty)
      setMapping(autoMapColumns(headerRow, loadRememberedMapping()))
      setStage('map')
    } catch {
      setError('Could not read this file. Upload a .csv, .xlsx or .xls file.')
    } finally {
      setBusy(false)
    }
  }

  const setColumnField = (col: number, field: GuestField | '') => {
    // A field can map to one column only; clear it elsewhere
    setMapping(mapping.map((f, i) => (i === col ? field : field && f === field ? '' : f)))
  }

  const handleCheck = () => {
    if (!mappingHasName(mapping)) {
      setError('Choose which columns hold the name (first and last name, or full name).')
      return
    }
    setError('')
    saveRememberedMapping(headers, mapping)
    const parsed = rowsToGuests(headers, rows, mapping)
    setGuests(parsed)
    setConflicts(findDuplicates(parsed, existing))
    setResolutions({})
    setStage('review')
  }

  const plan = useMemo(() => planImport(guests, conflicts, resolutions), [guests, conflicts, resolutions])

  const setAll = (resolution: Resolution) => {
    const next: Record<number, Resolution> = {}
    conflicts.forEach((c) => {
      next[c.rowIndex] = allowedResolutions(c).includes(resolution) ? resolution : 'first'
    })
    setResolutions(next)
  }

  const handleImport = async () => {
    setError('')
    setBusy(true)
    const taken = new Set(existing.map((g) => g.registration_id))
    let inserted = 0
    let updated = 0
    const failures: string[] = []

    // A batch insert sends every column for every row, so rows without a status
    // would get null instead of the column default: fill the defaults here
    const records = plan.inserts.map(({ guest }) => ({
      ...guest,
      registration_status: guest.registration_status ?? 'registered',
      attendance_confirmation: guest.attendance_confirmation ?? 'not_confirmed',
      event_id: eventUuid,
      source: 'import',
      registration_id: newRegistrationId(taken),
    }))
    for (let i = 0; i < records.length; i += INSERT_BATCH) {
      const batch = records.slice(i, i + INSERT_BATCH)
      const { error: insertError } = await supabase.from('registrations').insert(batch)
      if (insertError) {
        failures.push(`Rows ${i + 1}-${i + batch.length}: ${insertError.message}`)
      } else {
        inserted += batch.length
      }
    }

    for (const { guestId, guest } of plan.updates) {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ ...guest, updated_at: new Date().toISOString() })
        .eq('id', guestId)
      if (updateError) failures.push(`${guest.full_name}: ${updateError.message}`)
      else updated++
    }

    await supabase.from('import_jobs').insert([{ event_id: eventUuid, filename: fileName, row_count: inserted }])
    setBusy(false)

    if (failures.length > 0) {
      setError(`Imported ${inserted}, updated ${updated}, but some rows failed:\n${failures.join('\n')}`)
      return
    }
    const parts = [`Imported ${inserted} guest(s)`]
    if (updated) parts.push(`updated ${updated}`)
    if (plan.skipped.length) parts.push(`skipped ${plan.skipped.length}`)
    onDone(parts.join(', ') + ` from ${fileName}.`)
  }

  const describeRow = (g?: GuestInput) =>
    (g && [g.full_name, g.email, g.phone, g.company].filter(Boolean).join(' • ')) || '(empty)'

  return (
    <div style={panelStyle}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Import attendees</h2>

      {stage === 'file' && (
        <div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            Upload a .csv, .xlsx or .xls file. The first row must be column headers. Only the first sheet is read.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={busy}
            className="input-field"
            aria-label="Attendee list file"
          />
          {busy && <p style={{ marginTop: '8px' }}>Reading file...</p>}
        </div>
      )}

      {stage === 'map' && (
        <div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            <strong>{fileName}</strong>: {rows.length} row(s). Match each column to a guest field. Your choices are remembered for the next upload.
          </p>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={cell}>Column in file</th>
                  <th style={cell}>Example</th>
                  <th style={cell}>Import as</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ ...cell, fontWeight: 500 }}>{h || `(column ${i + 1})`}</td>
                    <td style={{ ...cell, color: 'var(--color-text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rows.find((r) => r[i]?.trim())?.[i] ?? ''}
                    </td>
                    <td style={cell}>
                      <select
                        value={mapping[i]}
                        onChange={(e) => setColumnField(i, e.target.value as GuestField | '')}
                        className="input-field"
                        aria-label={`Field for column ${h}`}
                        style={{ minWidth: '200px' }}
                      >
                        <option value="">— Ignore —</option>
                        {GUEST_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={handleCheck}>
              Check for duplicates
            </button>
            <button className="btn-secondary" onClick={() => setStage('file')}>
              Choose another file
            </button>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <Stat label="Rows in file" value={guests.length} />
            <Stat label="Will be added" value={plan.inserts.length} />
            <Stat label="Will update" value={plan.updates.length} />
            <Stat label="Duplicates" value={conflicts.length} />
            <Stat label="Skipped" value={plan.skipped.length} />
          </div>

          {conflicts.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Duplicates found</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '14px' }}>
                  Set all:
                  {(['first', 'second', 'both'] as Resolution[]).map((r) => (
                    <button key={r} type="button" className="btn-secondary" onClick={() => setAll(r)} style={{ padding: '4px 12px', minHeight: '32px' }}>
                      {RESOLUTION_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                &quot;First&quot; is the guest already on the list (or the earlier row). &quot;Second&quot; replaces it with the new row. &quot;Keep both&quot; isn&apos;t possible for the same email.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {conflicts.map((c) => {
                  const first = c.match.kind === 'existing' ? c.match.guest : guests[c.match.rowIndex]
                  const firstLabel = c.match.kind === 'existing'
                    ? `Already on list (${c.match.guest.registration_id})`
                    : `Row ${c.match.rowIndex + 2} of file`
                  const current = resolutions[c.rowIndex] ?? 'first'
                  return (
                    <div key={c.rowIndex} className="alert-warning" style={{ fontSize: '14px' }}>
                      <p style={{ fontWeight: 600, marginBottom: '4px' }}>
                        Same {c.reason === 'email' ? 'email' : 'name + company'}
                      </p>
                      <p>First — {firstLabel}: {describeRow(first)}</p>
                      <p style={{ marginBottom: '8px' }}>Second — Row {c.rowIndex + 2} of file: {describeRow(guests[c.rowIndex])}</p>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {allowedResolutions(c).map((r) => (
                          <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '32px' }}>
                            <input
                              type="radio"
                              name={`dup-${c.rowIndex}`}
                              checked={current === r}
                              onChange={() => setResolutions({ ...resolutions, [c.rowIndex]: r })}
                            />
                            {RESOLUTION_LABELS[r]}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {plan.skipped.length > 0 && (
            <details style={{ marginBottom: '16px', fontSize: '14px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
                {plan.skipped.length} row(s) will be skipped
              </summary>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                {plan.skipped.map((s) => (
                  <li key={s.rowIndex}>
                    Row {s.rowIndex + 2}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={busy || plan.inserts.length + plan.updates.length === 0}
            >
              {busy ? 'Importing...' : `Import ${plan.inserts.length} guest(s)${plan.updates.length ? ` and update ${plan.updates.length}` : ''}`}
            </button>
            <button className="btn-secondary" onClick={() => setStage('map')} disabled={busy}>
              Back to column matching
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-error" style={{ marginTop: '16px', whiteSpace: 'pre-line' }}>
          {error}
        </div>
      )}
    </div>
  )
}

const cell: React.CSSProperties = { padding: '8px 12px', whiteSpace: 'nowrap' }

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 600 }}>{value}</p>
    </div>
  )
}
