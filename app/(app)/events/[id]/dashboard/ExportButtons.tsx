'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toCsv } from '@/lib/guests'
import { REPORT_HEADERS, ReportCheckin, ReportRegistration, ReportRow, buildReport, rowToCells } from '@/lib/report'
import { formatDateTime } from '@/lib/time'

type Format = 'xlsx' | 'csv' | 'pdf'

interface Props {
  event: { id: string; event_id: string; name: string; location: string; status: string }
}

export default function ExportButtons({ event }: Props) {
  const [busy, setBusy] = useState<Format | null>(null)
  const [error, setError] = useState('')

  const exportReport = async (format: Format) => {
    setBusy(format)
    setError('')
    try {
      const [regRes, checkinRes] = await Promise.all([
        supabase
          .from('registrations')
          .select('id, registration_id, source, full_name, first_name, last_name, email, company_email, phone, designation, company')
          .eq('event_id', event.id),
        supabase.from('checkins').select('registration_id, checked_in_at').eq('event_id', event.id),
      ])
      if (regRes.error || checkinRes.error) throw new Error('load')

      const closed = event.status === 'closed'
      const report = buildReport((regRes.data ?? []) as ReportRegistration[], (checkinRes.data ?? []) as ReportCheckin[], closed)
      const absentTitle = closed ? 'No-shows' : 'Not yet arrived'
      const generated = `Generated ${formatDateTime(new Date().toISOString())}`
      const baseName = `${event.event_id}-report`

      if (format === 'csv') {
        const csv = toCsv([
          [event.name, event.location, generated],
          ...report.summary,
          [],
          REPORT_HEADERS,
          ...report.rows.map(rowToCells),
        ])
        download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`)
      } else if (format === 'xlsx') {
        const XLSX = await import('xlsx')
        const wb = XLSX.utils.book_new()
        const sheet = (rows: ReportRow[]) => {
          const ws = XLSX.utils.aoa_to_sheet([REPORT_HEADERS, ...rows.map(rowToCells)])
          ws['!cols'] = REPORT_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }))
          return ws
        }
        const summary = XLSX.utils.aoa_to_sheet([[event.name], [event.location], [generated], [], ...report.summary])
        summary['!cols'] = [{ wch: 28 }, { wch: 20 }]
        XLSX.utils.book_append_sheet(wb, summary, 'Summary')
        XLSX.utils.book_append_sheet(wb, sheet(report.rows), 'All attendees')
        XLSX.utils.book_append_sheet(wb, sheet(report.attended), 'Attended')
        XLSX.utils.book_append_sheet(wb, sheet(report.walkins), 'Walk-ins')
        XLSX.utils.book_append_sheet(wb, sheet(report.absent), absentTitle)
        XLSX.writeFile(wb, `${baseName}.xlsx`)
      } else {
        const { buildReportPdf } = await import('@/lib/pdf')
        const headers = ['Reg ID', 'Name', 'Company', 'Designation', 'Email', 'Phone', 'Check-in time']
        const widths = [7, 16, 15, 14, 22, 12, 14]
        const cells = (rows: ReportRow[]) =>
          rows.map((r) => [
            r.registrationId,
            [r.firstName, r.lastName].filter(Boolean).join(' '),
            r.company,
            r.designation,
            r.corporateEmail || r.personalEmail,
            r.phone,
            r.checkInTime,
          ])
        const bytes = await buildReportPdf(
          `${event.name} — Attendance report`,
          `${event.event_id} • ${event.location} • ${generated}`,
          report.summary,
          [
            { title: 'Attended (pre-registered)', headers, widths, rows: cells(report.attended) },
            { title: 'Walk-ins', headers, widths, rows: cells(report.walkins) },
            { title: absentTitle, headers, widths, rows: cells(report.absent) },
          ]
        )
        download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName}.pdf`)
      }
    } catch {
      setError('Could not create the report. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>Export report</h2>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {(['xlsx', 'csv', 'pdf'] as Format[]).map((f) => (
          <button key={f} className="btn-secondary" onClick={() => exportReport(f)} disabled={busy !== null}>
            {busy === f ? 'Preparing...' : { xlsx: 'Excel (.xlsx)', csv: 'CSV (.csv)', pdf: 'PDF (.pdf)' }[f]}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        Attendee list with check-in times, source and status, plus walk-ins and {event.status === 'closed' ? 'no-shows' : 'guests not yet arrived'}.
      </p>
      {error && <div className="alert-error" style={{ marginTop: '12px' }}>{error}</div>}
    </div>
  )
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
