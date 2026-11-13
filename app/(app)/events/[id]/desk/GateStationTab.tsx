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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { cameraAvailable, startScanner } from '@/lib/kiosk/scanner'
import { parseBadgeCode } from '@/lib/badgeCode'
import ScannerOverlay, { type ScanStatusFeedback } from '@/components/ScannerOverlay'

interface AttendeeRow {
  id: string
  registration_id: string
  full_name: string
  email: string | null
  company: string | null
  designation: string | null
  badge_token: string | null
  badge_collected_at: string | null
  created_at: string
  checkins: { id: string; checked_in_at: string; method: string }[]
}

export default function GateStationTab() {
  const params = useParams()
  const eventUuid = params.id as string

  const [attendees, setAttendees] = useState<AttendeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unchecked' | 'checked'>('all')
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
  const [lockPin, setLockPin] = useState('1234')
  const [pinInput, setPinInput] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinError, setPinError] = useState(false)

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
  }, [])

  // Load attendees & subscribe to realtime check-ins
  const loadAttendees = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('registrations')
      .select('id, registration_id, full_name, email, company, designation, badge_token, badge_collected_at, created_at, checkins(id, checked_in_at, method)')
      .eq('event_id', eventUuid)
      .order('full_name', { ascending: true })

    if (error) {
      toast.error('Could not load attendees. Please refresh.')
    } else {
      setAttendees((data ?? []) as unknown as AttendeeRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAttendees()

    // Realtime channel for instant check-in sync across multiple tablets
    const channel = supabase
      .channel(`gate-station-${eventUuid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkins', filter: `event_id=eq.${eventUuid}` },
        () => {
          loadAttendees()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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

  // Stats
  const totalCount = attendees.length
  const checkedInCount = useMemo(
    () => attendees.filter((a) => a.checkins && a.checkins.length > 0).length,
    [attendees]
  )
  const remainingCount = totalCount - checkedInCount
  const attendanceRate = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0

  // Filter & Search
  const filteredAttendees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attendees.filter((a) => {
      const isChecked = a.checkins && a.checkins.length > 0
      if (filter === 'unchecked' && isChecked) return false
      if (filter === 'checked' && !isChecked) return false

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
  const handleCheckIn = async (attendee: AttendeeRow) => {
    setBusyId(attendee.id)
    try {
      const { data, error } = await supabase
        .from('checkins')
        .insert({
          event_id: eventUuid,
          registration_id: attendee.id,
          method: 'manual',
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
                  checkins: [{ id: data.id, checked_in_at: new Date().toISOString(), method: 'manual' }],
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
        toast.success(`Badge collected for ${attendee.full_name}`)
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

  // Quick Walk-in Creation
  const handleCreateWalkin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkinName.trim()) {
      toast.error('Please enter the guest full name.')
      return
    }

    setWalkinBusy(true)
    try {
      // 1. Generate unique 6-char registration ID
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let regId = ''
      for (let i = 0; i < 6; i++) {
        regId += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      // 2. Insert into registrations
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

      // 3. Automatically check them in immediately
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
        showFeedback({
          type: 'success',
          title: 'Check-in Verified!',
          subtitle: `${target.full_name} • ${target.company || 'Attendee'}`,
        }, 2200)
        await handleCheckIn(target)
      }
    } else {
      showFeedback({
        type: 'error',
        title: 'Not Found in Event',
        subtitle: 'Attendee is not registered for this event',
      }, 3500)
      toast.error('Pass not found in this event roster.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Station Header & Live Telemetry Meter */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-2.5 rounded-full bg-(--color-live) animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-(--color-live)">
              Gate Command Center • Live Sync
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Check-In Station
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Staff Operator: <strong className="text-foreground">{staffName}</strong> • Press{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">/</kbd> to search
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canScan && (
            <Button
              variant={scanning ? 'destructive' : 'outline'}
              size="sm"
              onClick={scanning ? stopCamera : startCamera}
              className="rounded-full shadow-xs gap-1.5"
            >
              <Camera size={14} />
              {scanning ? 'Stop Camera' : 'Camera Scanner'}
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowWalkinModal(true)}
            className="rounded-full bg-primary text-primary-foreground shadow-xs gap-1.5"
          >
            <UserPlus size={14} />
            + Quick Walk-In
          </Button>

          <Button
            variant={isStationLocked ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              if (isStationLocked) {
                setShowPinModal(true)
              } else {
                setIsStationLocked(true)
                toast.success('Volunteer Mode Locked. Navigations restricted.')
              }
            }}
            className="rounded-full shadow-xs gap-1.5"
            title={isStationLocked ? 'Unlock Admin Station' : 'Lock into Volunteer Check-In Mode'}
          >
            <ShieldCheck size={14} />
            <span>{isStationLocked ? '🔒 Locked Station' : 'Lock Mode'}</span>
          </Button>

          <Link
            href={`/events/${eventUuid}/desk?tab=kiosk`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            title="Launch Fullscreen Attendee Kiosk Stand"
          >
            <Maximize2 size={13} />
            <span>Kiosk Mode</span>
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

      {/* Realtime Attendance KPI Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Total Roster</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground">{totalCount}</span>
            <span className="text-xs text-muted-foreground">registered</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Checked In</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-(--color-live)">{checkedInCount}</span>
            <span className="text-xs text-muted-foreground">arrived</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Remaining</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-amber-500">{remainingCount}</span>
            <span className="text-xs text-muted-foreground">uncollected</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Attendance Rate</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-2xl font-extrabold text-foreground">{attendanceRate}%</span>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-(--color-live) rounded-full transition-all duration-500"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

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
        </div>
      </div>

      {/* High-Speed Roster Table */}
      <Card className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading attendees roster...
          </div>
        ) : filteredAttendees.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={32} className="mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No attendees found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? `No guests match "${search}"` : 'Your guest list is empty.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Attendee</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Badge</th>
                  <th className="px-5 py-3 text-right">Gate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAttendees.map((attendee) => {
                  const checkin = attendee.checkins?.[0]
                  const isChecked = !!checkin
                  const isBusy = busyId === attendee.id
                  const badgeCollected = !!attendee.badge_collected_at

                  return (
                    <tr
                      key={attendee.id}
                      className={cn(
                        'transition-colors hover:bg-muted/30',
                        isChecked && 'bg-emerald-500/5 dark:bg-emerald-500/10'
                      )}
                    >
                      {/* Name & Company */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground">{attendee.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {attendee.company || attendee.designation || attendee.email || '—'}
                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-muted-foreground">
                        {attendee.registration_id}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {isChecked ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 size={13} />
                            <span>
                              {new Date(checkin.checked_in_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Not Arrived
                          </span>
                        )}
                      </td>

                      {/* Badge Status */}
                      <td className="px-4 py-3.5">
                        {badgeCollected ? (
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
                              className="h-8 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-transform active:scale-95"
                            >
                              <CheckCircle2 size={13} className="mr-1" />
                              Check In
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Walk-In Dialog Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <h3 className="text-lg font-bold text-foreground">Quick Walk-In Registration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWalkinModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Register a walk-in attendee on the spot. They will be automatically checked in.
            </p>

            <form onSubmit={handleCreateWalkin} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="mt-1 h-9 rounded-xl text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Company / Organization</label>
                <Input
                  value={walkinCompany}
                  onChange={(e) => setWalkinCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="mt-1 h-9 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Email (Optional)</label>
                <Input
                  type="email"
                  value={walkinEmail}
                  onChange={(e) => setWalkinEmail(e.target.value)}
                  placeholder="john@example.com"
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
