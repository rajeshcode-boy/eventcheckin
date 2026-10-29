'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
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

// Shared look of the add, edit, bulk-edit and import panels
export const panelClass = 'mb-6 rounded-md border border-border p-4'

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
    <div className={panelClass}>
      <h2 className="mb-4 text-xl font-semibold">Import attendees</h2>

      {stage === 'file' && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Upload a .csv, .xlsx or .xls file. The first row must be column headers. Only the first sheet is read.
          </p>
          <Input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={busy}
            className="h-auto py-2"
            aria-label="Attendee list file"
          />
          {busy && <p className="mt-2">Reading file...</p>}
        </div>
      )}

      {stage === 'map' && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            <strong>{fileName}</strong>: {rows.length} row(s). Match each column to a guest field. Your choices are remembered for the next upload.
          </p>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={cell}>Column in file</th>
                  <th className={cell}>Example</th>
                  <th className={cell}>Import as</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className={cn(cell, 'font-medium')}>{h || `(column ${i + 1})`}</td>
                    <td className={cn(cell, 'max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground')}>
                      {rows.find((r) => r[i]?.trim())?.[i] ?? ''}
                    </td>
                    <td className={cell}>
                      <NativeSelect
                        value={mapping[i]}
                        onChange={(e) => setColumnField(i, e.target.value as GuestField | '')}
                        className="h-10 min-w-[200px]"
                        aria-label={`Field for column ${h}`}
                      >
                        <option value="">— Ignore —</option>
                        {GUEST_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCheck}>Check for duplicates</Button>
            <Button variant="outline" onClick={() => setStage('file')}>Choose another file</Button>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div>
          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            <Stat label="Rows in file" value={guests.length} />
            <Stat label="Will be added" value={plan.inserts.length} />
            <Stat label="Will update" value={plan.updates.length} />
            <Stat label="Duplicates" value={conflicts.length} />
            <Stat label="Skipped" value={plan.skipped.length} />
          </div>

          {conflicts.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Duplicates found</h3>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  Set all:
                  {(['first', 'second', 'both'] as Resolution[]).map((r) => (
                    <Button key={r} type="button" variant="outline" size="sm" onClick={() => setAll(r)}>
                      {RESOLUTION_LABELS[r]}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                &quot;First&quot; is the guest already on the list (or the earlier row). &quot;Second&quot; replaces it with the new row. &quot;Keep both&quot; isn&apos;t possible for the same email.
              </p>
              <div className="flex flex-col gap-2">
                {conflicts.map((c) => {
                  const first = c.match.kind === 'existing' ? c.match.guest : guests[c.match.rowIndex]
                  const firstLabel = c.match.kind === 'existing'
                    ? `Already on list (${c.match.guest.registration_id})`
                    : `Row ${c.match.rowIndex + 2} of file`
                  const current = resolutions[c.rowIndex] ?? 'first'
                  return (
                    <Alert key={c.rowIndex} variant="warning">
                      <p className="mb-1 font-semibold">
                        Same {c.reason === 'email' ? 'email' : 'name + company'}
                      </p>
                      <p>First — {firstLabel}: {describeRow(first)}</p>
                      <p className="mb-2">Second — Row {c.rowIndex + 2} of file: {describeRow(guests[c.rowIndex])}</p>
                      <div className="flex flex-wrap gap-4">
                        {allowedResolutions(c).map((r) => (
                          <label key={r} className="flex min-h-8 items-center gap-1.5">
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
                    </Alert>
                  )
                })}
              </div>
            </div>
          )}

          {plan.skipped.length > 0 && (
            <details className="mb-4 text-sm">
              <summary className="cursor-pointer font-medium">
                {plan.skipped.length} row(s) will be skipped
              </summary>
              <ul className="mt-2 pl-5">
                {plan.skipped.map((s) => (
                  <li key={s.rowIndex}>
                    Row {s.rowIndex + 2}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleImport} disabled={busy || plan.inserts.length + plan.updates.length === 0}>
              {busy ? 'Importing...' : `Import ${plan.inserts.length} guest(s)${plan.updates.length ? ` and update ${plan.updates.length}` : ''}`}
            </Button>
            <Button variant="outline" onClick={() => setStage('map')} disabled={busy}>
              Back to column matching
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="error" className="mt-4 whitespace-pre-line">
          {error}
        </Alert>
      )}
    </div>
  )
}

const cell = 'whitespace-nowrap px-3 py-2'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  )
}
