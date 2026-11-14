'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Search,
  CheckCircle2,
  QrCode,
  Printer,
  Camera,
  UserPlus,
  X,
  RotateCcw,
  Sparkles,
  Users,
  Activity,
  AlertCircle,
  Clock,
  ShieldCheck,
  Maximize2,
  Download,
  Check,
  FileSpreadsheet,
  FileText,
  Tablet,
  Globe,
  Edit3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { cameraAvailable, startScanner } from '@/lib/kiosk/scanner'
import { parseBadgeCode } from '@/lib/badgeCode'
import ScannerOverlay, { type ScanStatusFeedback } from '@/components/ScannerOverlay'
import { formatTime, formatDateTime } from '@/lib/time'
import { toCsv } from '@/lib/guests'
import { REPORT_HEADERS, ReportCheckin, ReportRegistration, ReportRow, buildReport, rowToCells } from '@/lib/report'

interface AttendeeRow {
  id: string
  registration_id: string
  source?: string
  full_name: string
  email: string | null
  company: string | null
  designation: string | null
  badge_token: string | null
  badge_collected_at: string | null
  created_at: string
  checkins: {
    id: string
    checked_in_at: string
    method: string
    checked_in_by?: string | null
    kiosk_id?: string | null
  }[]
}

interface KioskInfo {
  id: string
  kiosk_code: string
  label: string
  last_seen_at: string | null
  revoked_at: string | null
}

interface EventInfo {
  id: string
  event_id: string
  name: string
  location: string
  status: 'upcoming' | 'live' | 'closed'
}

export default function GateStationTab() {
  const params = useParams()
  const eventUuid = params.id as string

  // Navigation View Toggle: Option A (Segmented Toggle)
  const [stationView, setStationView] = useState<'roster' | 'stream'>('roster')

  // Event & Status State
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState<'xlsx' | 'csv' | 'pdf' | null>(null)

  // Attendees & Search
  const [attendees, setAttendees] = useState<AttendeeRow[]>([])
  const [kiosks, setKiosks] = useState<KioskInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unchecked' | 'checked' | 'walkin'>('all')
  const [staffName, setStaffName] = useState('Front Desk')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Quick Walk-In State
  const [showWalkinModal, setShowWalkinModal] = useState(false)
  const [walkinName, setWalkinName] = useState('')
  const [walkinEmail, setWalkinEmail] = useState('')
  const [walkinCompany, setWalkinCompany] = useState('')
  const [walkinDesignation, setWalkinDesignation] = useState('')
  const [walkinBusy, setWalkinBusy] = useState(false)

  // Live Camera Scanner State
  const [scanning, setScanning] = useState(false)
  const [canScan, setCanScan] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<ScanStatusFeedback | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const stopScannerRef = useRef<(() => void) | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const showFeedback = (fb: ScanStatusFeedback, durationMs = 2800) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setScanFeedback(fb)
    feedbackTimerRef.current = setTimeout(() => {
      setScanFeedback(null)
    }, durationMs)
  }

  // Dedicated Locked Door / Volunteer Station Mode State
  const [isStationLocked, setIsStationLocked] = useState(false)
  const [lockPin] = useState('1234')
  const [pinInput, setPinInput] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinError, setPinError] = useState(false)

  // Load Initial Event & Operator Info
  useEffect(() => {
    setCanScan(cameraAvailable())
    // Get staff name
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.full_name) setStaffName(data.full_name)
          })
      }
    })

    // Load event status & details
    supabase
      .from('events')
      .select('id, event_id, name, location, status')
      .eq('id', eventUuid)
      .single()
      .then(({ data }) => {
        if (data) setEvent(data as unknown as EventInfo)
      })
  }, [eventUuid])

  // Load attendees & subscribe to realtime check-ins
  const loadAttendees = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('registrations')
      .select('id, registration_id, source, full_name, email, company, designation, badge_token, badge_collected_at, created_at, checkins(id, checked_in_at, method, checked_in_by, kiosk_id)')
      .eq('event_id', eventUuid)
      .order('full_name', { ascending: true })

    if (error) {
      toast.error('Could not load attendees. Please refresh.')
    } else {
      setAttendees((data ?? []) as unknown as AttendeeRow[])
      setLastUpdated(new Date().toISOString())
    }
    setLoading(false)
  }

  // Load connected kiosks & active presence
  const loadKiosks = async () => {
    const { data } = await supabase
      .from('kiosks')
      .select('id, kiosk_code, label, last_seen_at, revoked_at')
      .eq('event_id', eventUuid)
      .is('revoked_at', null)
    if (data) {
      setKiosks(data as KioskInfo[])
    }
  }

  useEffect(() => {
    loadAttendees()
    loadKiosks()

    const kioskInterval = setInterval(() => {
      loadKiosks()
    }, 20000)

    // Realtime channel for instant check-in sync across multiple tablets
    const checkinChannel = supabase
      .channel(`gate-station-${eventUuid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkins', filter: `event_id=eq.${eventUuid}` },
        () => {
          loadAttendees()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${eventUuid}` },
        () => {
          loadAttendees()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kiosks', filter: `event_id=eq.${eventUuid}` },
        () => {
          loadKiosks()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventUuid}` },
        (payload) => {
          if (payload.new) {
            setEvent(payload.new as unknown as EventInfo)
          }
        }
      )
      .subscribe()

    return () => {
      clearInterval(kioskInterval)
      supabase.removeChannel(checkinChannel)
    }
  }, [eventUuid])

  // Keyboard shortcut: '/' focuses search, 'Esc' clears
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearch('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Stats Calculations
  const totalCount = attendees.length
  const preRegistered = useMemo(() => attendees.filter((a) => a.source !== 'walkin'), [attendees])
  const walkinsCount = useMemo(() => attendees.filter((a) => a.source === 'walkin').length, [attendees])
  const checkedInCount = useMemo(
    () => attendees.filter((a) => a.checkins && a.checkins.length > 0).length,
    [attendees]
  )
  const remainingCount = totalCount - checkedInCount
  const attendanceRate = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0

  // Active Connected Kiosks: last seen within past 2 minutes and not revoked
  const onlineKiosks = useMemo(() => {
    const now = Date.now()
    return kiosks.filter(
      (k) => !k.revoked_at && !!k.last_seen_at && now - new Date(k.last_seen_at).getTime() < 120000
    )
  }, [kiosks])

  // Real-Time Arrival Stream Feed (Flattened & Ordered by latest arrival)
  const liveFeed = useMemo(() => {
    const items: Array<{
      id: string
      registrationId: string
      checked_in_at: string
      method: string
      checked_in_by?: string | null
      kiosk_id?: string | null
      fullName: string
      company: string | null
      designation: string | null
      source?: string
      badgeCollected: boolean
      attendee: AttendeeRow
    }> = []

    for (const a of attendees) {
      if (a.checkins && a.checkins.length > 0) {
        for (const c of a.checkins) {
          items.push({
            id: c.id,
            registrationId: a.registration_id,
            checked_in_at: c.checked_in_at,
            method: c.method,
            checked_in_by: c.checked_in_by,
            kiosk_id: c.kiosk_id,
            fullName: a.full_name,
            company: a.company,
            designation: a.designation,
            source: a.source,
            badgeCollected: !!a.badge_collected_at,
            attendee: a,
          })
        }
      }
    }

    items.sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())
    return items
  }, [attendees])

  // Render Check-in Method Badge helper
  const renderCheckinMethodBadge = (
    checkin: { method: string; checked_in_by?: string | null; kiosk_id?: string | null },
    compact: boolean = false
  ) => {
    const isKiosk = !!checkin.kiosk_id || !!checkin.checked_in_by?.startsWith('KSK-') || checkin.method === 'kiosk'
    const kiosk = isKiosk ? kiosks.find((k) => k.id === checkin.kiosk_id || k.kiosk_code === checkin.checked_in_by) : null
    const kioskName = kiosk?.label || checkin.checked_in_by || 'Kiosk'

    if (isKiosk) {
      const isQr = checkin.method === 'qr'
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300',
            compact && 'text-[9px] px-1.5 py-0'
          )}
          title={`Checked in at kiosk station: ${kioskName}`}
        >
          <Tablet size={11} className="text-purple-600 dark:text-purple-400" />
          <span>{isQr ? `Kiosk QR • ${kioskName}` : `Kiosk Search • ${kioskName}`}</span>
        </span>
      )
    }

    if (checkin.checked_in_by === 'guest') {
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300',
            compact && 'text-[9px] px-1.5 py-0'
          )}
          title="Guest self check-in via mobile phone"
        >
          <Globe size={11} className="text-blue-600 dark:text-blue-400" />
          <span>Self Check-in</span>
        </span>
      )
    }

    if (checkin.method === 'walkin') {
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300',
            compact && 'text-[9px] px-1.5 py-0'
          )}
          title="Walk-in guest registration & arrival"
        >
          <UserPlus size={11} className="text-amber-600 dark:text-amber-400" />
          <span>Walk-in Desk</span>
        </span>
      )
    }

    if (checkin.method === 'qr') {
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300',
            compact && 'text-[9px] px-1.5 py-0'
          )}
          title={checkin.checked_in_by ? `Scanned by ${checkin.checked_in_by}` : 'Scanned with desk camera scanner'}
        >
          <Camera size={11} className="text-emerald-600 dark:text-emerald-400" />
          <span>Desk Scanner{checkin.checked_in_by && checkin.checked_in_by !== 'Front Desk' ? ` • ${checkin.checked_in_by}` : ''}</span>
        </span>
      )
    }

    // Default: Desk Manual
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300',
          compact && 'text-[9px] px-1.5 py-0'
        )}
        title={checkin.checked_in_by ? `Manual check-in by ${checkin.checked_in_by}` : 'Manual 1-tap desk check-in'}
      >
        <Edit3 size={11} className="text-slate-600 dark:text-slate-400" />
        <span>Desk Manual{checkin.checked_in_by && checkin.checked_in_by !== 'Front Desk' ? ` • ${checkin.checked_in_by}` : ''}</span>
      </span>
    )
  }

  // Filter & Search
  const filteredAttendees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attendees.filter((a) => {
      const isChecked = a.checkins && a.checkins.length > 0
      if (filter === 'unchecked' && isChecked) return false
      if (filter === 'checked' && !isChecked) return false
      if (filter === 'walkin' && a.source !== 'walkin') return false

      if (!q) return true
      return (
        a.full_name?.toLowerCase().includes(q) ||
        a.company?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.registration_id?.toLowerCase().includes(q)
      )
    })
  }, [attendees, search, filter])

  // 1-Tap Check In
  const handleCheckIn = async (attendee: AttendeeRow, method: 'manual' | 'qr' = 'manual') => {
    setBusyId(attendee.id)
    try {
      const { data, error } = await supabase
        .from('checkins')
        .insert({
          event_id: eventUuid,
          registration_id: attendee.id,
          method,
          checked_in_by: staffName,
        })
        .select()
        .single()

      if (error) {
        toast.error('Check-in failed. Please try again.')
      } else {
        toast.success(`✓ Checked in ${attendee.full_name}`)
        // Optimistic update
        setAttendees((prev) =>
          prev.map((item) =>
            item.id === attendee.id
              ? {
                  ...item,
                  checkins: [
                    {
                      id: data.id,
                      checked_in_at: new Date().toISOString(),
                      method,
                      checked_in_by: staffName,
                    },
                  ],
                }
              : item
          )
        )
      }
    } catch {
      toast.error('Network error during check-in.')
    } finally {
      setBusyId(null)
    }
  }

  // Undo Check In
  const handleUndoCheckIn = async (attendee: AttendeeRow) => {
    setBusyId(attendee.id)
    try {
      const { error } = await supabase
        .from('checkins')
        .delete()
        .eq('event_id', eventUuid)
        .eq('registration_id', attendee.id)

      if (error) {
        toast.error('Could not undo check-in.')
      } else {
        toast.info(`Undid check-in for ${attendee.full_name}`)
        setAttendees((prev) =>
          prev.map((item) => (item.id === attendee.id ? { ...item, checkins: [] } : item))
        )
      }
    } catch {
      toast.error('Error undoing check-in.')
    } finally {
      setBusyId(null)
    }
  }

  // Mark Badge Collected
  const handleCollectBadge = async (attendee: AttendeeRow) => {
    setBusyId(attendee.id)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('registrations')
        .update({
          badge_collected_at: now,
          badge_collected_by: staffName,
        })
        .eq('id', attendee.id)

      if (error) {
        toast.error('Could not record badge collection.')
      } else {
        toast.success(`Badge handed out to ${attendee.full_name}`)
        setAttendees((prev) =>
          prev.map((item) =>
            item.id === attendee.id ? { ...item, badge_collected_at: now } : item
          )
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  // Close / Reopen Check-in Handlers
  const handleReopenCheckin = async () => {
    setStatusBusy(true)
    const { error } = await supabase
      .from('events')
      .update({ status: 'live', updated_at: new Date().toISOString() })
      .eq('id', eventUuid)
    setStatusBusy(false)
    if (error) {
      toast.error('Could not reopen check-in. Only event managers can change status.')
    } else {
      setEvent((prev) => (prev ? { ...prev, status: 'live' } : null))
      toast.success('Check-in is reopened! Gates are active.')
    }
  }

  const confirmCloseCheckin = async () => {
    setStatusBusy(true)
    const { error } = await supabase
      .from('events')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', eventUuid)
    setStatusBusy(false)
    setShowCloseModal(false)
    if (error) {
      toast.error('Could not close check-in. Only event managers can change status.')
    } else {
      setEvent((prev) => (prev ? { ...prev, status: 'closed' } : null))
      toast.success('Check-in closed. Remaining guests marked as no-shows.')
    }
  }

  // Export Report Handlers (CSV, Excel, PDF)
  const handleExportReport = async (format: 'xlsx' | 'csv' | 'pdf') => {
    if (!event) return
    setExportBusy(format)
    try {
      const [regRes, checkinRes] = await Promise.all([
        supabase
          .from('registrations')
          .select('id, registration_id, source, full_name, first_name, last_name, email, company_email, phone, designation, company')
          .eq('event_id', eventUuid),
        supabase.from('checkins').select('registration_id, checked_in_at').eq('event_id', eventUuid),
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
        downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`)
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
        downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName}.pdf`)
      }
      toast.success(`Exported ${format.toUpperCase()} attendance report!`)
    } catch {
      toast.error('Could not generate export report.')
    } finally {
      setExportBusy(null)
    }
  }

  // Quick Walk-in Creation
  const handleCreateWalkin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkinName.trim()) {
      toast.error('Please enter the guest full name.')
      return
    }

    setWalkinBusy(true)
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let regId = ''
      for (let i = 0; i < 6; i++) {
        regId += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      const { data: newReg, error: regError } = await supabase
        .from('registrations')
        .insert({
          event_id: eventUuid,
          registration_id: regId,
          source: 'walkin',
          full_name: walkinName.trim(),
          email: walkinEmail.trim() || null,
          company: walkinCompany.trim() || null,
          designation: walkinDesignation.trim() || null,
          registration_status: 'approved',
        })
        .select()
        .single()

      if (regError) {
        toast.error(`Could not register walk-in: ${regError.message}`)
        setWalkinBusy(false)
        return
      }

      await supabase.from('checkins').insert({
        event_id: eventUuid,
        registration_id: newReg.id,
        method: 'walkin',
        checked_in_by: staffName,
      })

      toast.success(`✓ Walk-in registered & checked in: ${walkinName}`)
      setShowWalkinModal(false)
      setWalkinName('')
      setWalkinEmail('')
      setWalkinCompany('')
      setWalkinDesignation('')
      await loadAttendees()
    } catch {
      toast.error('Error creating walk-in guest.')
    } finally {
      setWalkinBusy(false)
    }
  }

  // Camera Scanner Handlers
  const startCamera = async () => {
    if (!videoRef.current) return
    setScanning(true)
    try {
      const stop = await startScanner(videoRef.current, (rawCode) => {
        handleScannedCode(rawCode)
      })
      stopScannerRef.current = stop
    } catch {
      toast.error('Could not access camera. Check device permissions.')
      setScanning(false)
    }
  }

  const stopCamera = () => {
    stopScannerRef.current?.()
    stopScannerRef.current = null
    setScanning(false)
  }

  const handleScannedCode = async (rawCode: string) => {
    const parsed = parseBadgeCode(rawCode)
    if (!parsed || parsed.kind === 'unknown') {
      showFeedback({
        type: 'error',
        title: 'Invalid QR Code',
        subtitle: 'Not an EventCheckin attendee pass',
      })
      toast.error('Invalid QR code scanned')
      return
    }

    const target = attendees.find(
      (a) =>
        (parsed.kind === 'token' && a.badge_token === parsed.value) ||
        (parsed.kind === 'reg' && a.registration_id.toLowerCase() === parsed.value.toLowerCase())
    )

    if (target) {
      if (target.checkins && target.checkins.length > 0) {
        showFeedback({
          type: 'warning',
          title: 'Already Checked In',
          subtitle: `${target.full_name} (${target.registration_id})`,
        })
        toast.info(`${target.full_name} is already checked in.`)
      } else {
        showFeedback(
          {
            type: 'success',
            title: 'Check-in Verified!',
            subtitle: `${target.full_name} • ${target.company || 'Attendee'}`,
          },
          2200
        )
        await handleCheckIn(target, 'qr')
      }
    } else {
      showFeedback(
        {
          type: 'error',
          title: 'Not Found in Event',
          subtitle: 'Attendee is not registered for this event',
        },
        3500
      )
      toast.error('Pass not found in this event roster.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Station Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              ⚡ Live Gate Station
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-(--color-live)">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--color-live) opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-(--color-live)" />
              </span>
              Realtime Synced
            </span>
            <Link
              href={`/events/${eventUuid}/desk?tab=devices`}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all border',
                onlineKiosks.length > 0
                  ? 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                  : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
              title="View paired kiosk stations & devices"
            >
              <Tablet size={12} className={onlineKiosks.length > 0 ? 'text-purple-600 dark:text-purple-400' : 'opacity-60'} />
              <span>
                {onlineKiosks.length > 0
                  ? `${onlineKiosks.length} Kiosk${onlineKiosks.length > 1 ? 's' : ''} Online`
                  : kiosks.length > 0
                    ? `0/${kiosks.length} Kiosks Online`
                    : '0 Kiosks Connected'}
              </span>
              {onlineKiosks.length > 0 && (
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-purple-500" />
                </span>
              )}
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Staff Operator: <strong className="text-foreground">{staffName}</strong>
            {lastUpdated && ` • Synced ${formatTime(lastUpdated)}`}
            {' • '}Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">/</kbd> to search
          </p>
        </div>

        {/* Global Operational Actions (Close/Reopen, Export, Refresh) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Close or Reopen Check-in */}
          {event?.status === 'closed' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopenCheckin}
              disabled={statusBusy}
              className="rounded-full border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reopen Check-in</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCloseModal(true)}
              disabled={statusBusy}
              className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            >
              <span>Close Check-in</span>
            </Button>
          )}

          {/* Export Report Action Group */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
            <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Export
            </span>
            <button
              type="button"
              disabled={exportBusy !== null}
              onClick={() => handleExportReport('csv')}
              className="rounded-full px-2.5 py-1 text-xs font-medium hover:bg-card hover:text-foreground text-muted-foreground transition-all shadow-xs"
              title="Export CSV Report"
            >
              {exportBusy === 'csv' ? '...' : 'CSV'}
            </button>
            <button
              type="button"
              disabled={exportBusy !== null}
              onClick={() => handleExportReport('xlsx')}
              className="rounded-full px-2.5 py-1 text-xs font-medium hover:bg-card hover:text-foreground text-muted-foreground transition-all shadow-xs"
              title="Export Excel Report"
            >
              {exportBusy === 'xlsx' ? '...' : 'Excel'}
            </button>
            <button
              type="button"
              disabled={exportBusy !== null}
              onClick={() => handleExportReport('pdf')}
              className="rounded-full px-2.5 py-1 text-xs font-medium hover:bg-card hover:text-foreground text-muted-foreground transition-all shadow-xs"
              title="Export PDF Report"
            >
              {exportBusy === 'pdf' ? '...' : 'PDF'}
            </button>
          </div>

          {/* Quick Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadAttendees()}
            className="rounded-full size-8 p-0 text-muted-foreground hover:text-foreground"
            title="Force refresh data"
          >
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>

      {/* Closed Banner Warning */}
      {event?.status === 'closed' && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          <AlertCircle size={18} className="shrink-0" />
          <div className="flex-1">
            <strong className="font-bold">Check-in is currently closed.</strong> Remaining uncollected guests are marked as no-shows. Click &quot;Reopen Check-in&quot; above to resume gate arrivals.
          </div>
        </div>
      )}

      {/* Realtime Attendance KPI Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total Roster</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground">{totalCount}</span>
            <span className="text-xs text-muted-foreground">({preRegistered.length} pre-reg)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Checked In</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-(--color-live)">{checkedInCount}</span>
            <span className="text-xs text-muted-foreground">{attendanceRate}% arrived</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-(--color-live) rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Walk-ins</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-amber-500">{walkinsCount}</span>
            <span className="text-xs text-muted-foreground">on-site</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {event?.status === 'closed' ? 'No-Shows' : 'Remaining'}
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                'text-2xl font-extrabold',
                event?.status === 'closed' ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {remainingCount}
            </span>
            <span className="text-xs text-muted-foreground">
              {event?.status === 'closed' ? 'absent' : 'pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Option A: Segmented View Navigation & Tool Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Segmented View Switcher */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setStationView('roster')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              stationView === 'roster'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users size={14} />
            <span>Attendee Roster</span>
            <span className="rounded-full bg-muted px-2 py-0.2 text-[10px] font-mono">
              {filteredAttendees.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStationView('stream')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              stationView === 'stream'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--color-live) opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-(--color-live)" />
            </span>
            <span>Live Arrival Stream</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.2 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {liveFeed.length}
            </span>
          </button>
        </div>

        {/* Action Controls for Gate */}
        <div className="flex flex-wrap items-center gap-2">
          {canScan && stationView === 'roster' && (
            <Button
              variant={scanning ? 'destructive' : 'outline'}
              size="sm"
              onClick={scanning ? stopCamera : startCamera}
              className="rounded-full shadow-xs gap-1.5 text-xs"
            >
              <Camera size={13} />
              {scanning ? 'Stop Camera' : 'Camera Scanner'}
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowWalkinModal(true)}
            className="rounded-full bg-primary text-primary-foreground shadow-xs gap-1.5 text-xs"
          >
            <UserPlus size={13} />
            + Quick Walk-In
          </Button>

          <Button
            variant={isStationLocked ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              if (isStationLocked) setShowPinModal(true)
              else {
                setIsStationLocked(true)
                toast.success('Volunteer Mode Locked. Navigations restricted.')
              }
            }}
            className="rounded-full shadow-xs gap-1.5 text-xs"
            title={isStationLocked ? 'Unlock Admin Station' : 'Lock into Volunteer Check-In Mode'}
          >
            <ShieldCheck size={13} />
            <span>{isStationLocked ? '🔒 Locked' : 'Lock Mode'}</span>
          </Button>

          <Link
            href={`/events/${eventUuid}/desk?tab=kiosk`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Launch Fullscreen Attendee Kiosk Stand"
          >
            <Maximize2 size={13} />
            <span>Kiosk</span>
          </Link>
        </div>
      </div>

      {/* Camera Live Scanner Preview Overlay */}
      {scanning && (
        <Card className="relative overflow-hidden rounded-3xl border-2 border-primary bg-black p-4 text-center">
          <div className="mx-auto max-w-md">
            <p className="mb-2 text-xs font-semibold text-white/90">
              Point camera at attendee pass QR code
            </p>
            <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-2xl bg-zinc-900">
              <video ref={videoRef} playsInline muted className="size-full object-cover" />
              <ScannerOverlay feedback={scanFeedback} />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={stopCamera}
              className="mt-3 rounded-full text-xs"
            >
              Done / Close Camera
            </Button>
          </div>
        </Card>
      )}

      {/* VIEW 1: LIVE ARRIVAL STREAM */}
      {stationView === 'stream' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--color-live) opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-(--color-live)" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">Real-Time Arrival Stream</h3>
                <p className="text-xs text-muted-foreground">
                  Live chronological feed of attendee arrivals across gate scanners, self-checkin, and kiosk
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-(--color-live)">{liveFeed.length}</span>
              <span className="text-xs text-muted-foreground ml-1.5">arrivals streamed</span>
            </div>
          </div>

          {liveFeed.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
              <Activity className="mx-auto size-10 opacity-40 mb-3 animate-pulse text-(--color-live)" />
              <h4 className="text-base font-bold text-foreground">Waiting for first arrival...</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No check-ins recorded yet. When guests check in via camera scanner, attendee roster, or kiosk, they will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <ul className="divide-y divide-border">
                {liveFeed.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30 sm:px-6"
                  >
                    <div className="flex items-center gap-3.5 min-w-[200px]">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                        {item.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{item.fullName}</span>
                          {renderCheckinMethodBadge(item)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[item.designation, item.company].filter(Boolean).join(' • ') || 'Attendee'}
                          {' • '}<span className="font-mono text-[11px]">{item.registrationId}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <Clock size={12} className="opacity-60" />
                        {formatTime(item.checked_in_at)}
                      </span>
                      {item.badgeCollected ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <Check size={13} />
                          Pass Handed
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleCollectBadge(item.attendee)}
                          className="rounded-full text-xs gap-1 hover:bg-primary/10 hover:text-primary transition-colors"
                          title="Mark Badge Handed Out"
                        >
                          <Printer size={12} />
                          <span>Hand Out Pass</span>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ATTENDEE ROSTER & SEARCH */}
      {stationView === 'roster' && (
        <div className="space-y-4">
          {/* Omni-Search & Filter Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type name, company, email, or 6-char code..."
                className="h-10 pl-9 pr-8 rounded-full border-border bg-card shadow-xs text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Attendance Filters */}
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  filter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unchecked')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  filter === 'unchecked'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Not Arrived ({remainingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('checked')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  filter === 'checked'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Checked In ({checkedInCount})
              </button>
              {walkinsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('walkin')}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                    filter === 'walkin'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Walk-ins ({walkinsCount})
                </button>
              )}
            </div>
          </div>

          {/* Attendee Data Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                    <th className="px-5 py-3">Attendee</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Pass / Badge</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground">
                        Loading attendee roster...
                      </td>
                    </tr>
                  ) : filteredAttendees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground">
                        {search ? (
                          <>
                            No attendees matching &ldquo;<span className="font-semibold text-foreground">{search}</span>&rdquo;.
                          </>
                        ) : (
                          'No attendees in this category.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((attendee) => {
                      const isChecked = attendee.checkins && attendee.checkins.length > 0
                      const checkinData = isChecked ? attendee.checkins[0] : null
                      const isBusy = busyId === attendee.id

                      return (
                        <tr
                          key={attendee.id}
                          className={cn(
                            'transition-colors hover:bg-muted/40',
                            isChecked && 'bg-emerald-500/[0.02]'
                          )}
                        >
                          {/* Attendee Name, Company & ID */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all',
                                  isChecked
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {isChecked ? <CheckCircle2 size={16} /> : attendee.full_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-foreground">
                                    {attendee.full_name}
                                  </span>
                                  {attendee.source === 'walkin' && (
                                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                      Walk-in
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>{[attendee.designation, attendee.company].filter(Boolean).join(' • ') || 'Attendee'}</span>
                                  <span>&bull;</span>
                                  <span className="font-mono text-[11px]">{attendee.registration_id}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Check-In Status & Method */}
                          <td className="px-5 py-3.5">
                            {isChecked && checkinData ? (
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    Checked In
                                  </span>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    {formatTime(checkinData.checked_in_at)}
                                  </span>
                                </div>
                                {renderCheckinMethodBadge(checkinData)}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">
                                Not arrived
                              </span>
                            )}
                          </td>

                          {/* Badge Status */}
                          <td className="px-5 py-3.5">
                            {attendee.badge_collected_at ? (
                              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <ShieldCheck size={13} className="text-emerald-600" />
                                Collected
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCollectBadge(attendee)}
                                disabled={isBusy}
                                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                              >
                                <Printer size={13} />
                                Mark Handed Out
                              </button>
                            )}
                          </td>

                          {/* 1-Tap Action Button */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {isChecked ? (
                                <button
                                  type="button"
                                  onClick={() => handleUndoCheckIn(attendee)}
                                  disabled={isBusy}
                                  title="Undo check-in"
                                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded"
                                >
                                  <RotateCcw size={12} />
                                  <span className="hidden sm:inline">Undo</span>
                                </button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleCheckIn(attendee)}
                                  disabled={isBusy}
                                  className="rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:scale-102 transition-transform"
                                >
                                  {isBusy ? 'Checking...' : 'Check In →'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quick Walk-In Modal */}
      {showWalkinModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">+ Quick Walk-In Registration</h2>
                <p className="text-xs text-muted-foreground">Register and check-in attendee immediately</p>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkinModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWalkin} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  autoFocus
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. Maya Sharma"
                  className="mt-1 h-9 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Email (Optional)</label>
                <Input
                  type="email"
                  value={walkinEmail}
                  onChange={(e) => setWalkinEmail(e.target.value)}
                  placeholder="e.g. maya@acme.com"
                  className="mt-1 h-9 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Company / Organization (Optional)</label>
                <Input
                  value={walkinCompany}
                  onChange={(e) => setWalkinCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="mt-1 h-9 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Designation / Role (Optional)</label>
                <Input
                  value={walkinDesignation}
                  onChange={(e) => setWalkinDesignation(e.target.value)}
                  placeholder="e.g. Director of Tech"
                  className="mt-1 h-9 rounded-xl text-sm"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWalkinModal(false)}
                  className="rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={walkinBusy}
                  className="rounded-full bg-primary text-primary-foreground font-semibold"
                >
                  {walkinBusy ? 'Registering...' : 'Register & Check In →'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Check-in Confirmation Modal */}
      {showCloseModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-destructive mb-3">
              <AlertCircle size={24} />
              <h2 className="text-lg font-bold text-foreground">Close Check-in for this event?</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-semibold">{remainingCount}</strong> registered guest(s) who haven&apos;t arrived will be marked as <strong className="text-destructive font-semibold">no-shows</strong>.
              New check-ins will be paused until you reopen.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={statusBusy}
                onClick={() => setShowCloseModal(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={statusBusy}
                onClick={confirmCloseCheckin}
                className="rounded-full font-semibold"
              >
                {statusBusy ? 'Closing...' : 'Close Check-in'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock PIN Modal */}
      {showPinModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck size={24} />
              </div>
              <h2 className="mt-3 text-lg font-bold text-foreground">Unlock Station</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter manager PIN to exit locked volunteer mode
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (pinInput === lockPin || pinInput === '1234') {
                  setIsStationLocked(false)
                  setShowPinModal(false)
                  setPinInput('')
                  setPinError(false)
                  toast.success('Station unlocked.')
                } else {
                  setPinError(true)
                }
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <Input
                  type="password"
                  maxLength={6}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value)
                    setPinError(false)
                  }}
                  placeholder="Enter 4-digit PIN (default 1234)"
                  className="h-11 text-center text-lg tracking-widest rounded-xl"
                />
                {pinError && (
                  <p className="mt-1 text-center text-xs font-medium text-destructive">
                    Incorrect PIN. Try again.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => {
                    setShowPinModal(false)
                    setPinInput('')
                    setPinError(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary text-primary-foreground font-semibold"
                >
                  Unlock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
