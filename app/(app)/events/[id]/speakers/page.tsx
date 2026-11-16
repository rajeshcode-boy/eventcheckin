'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Mic,
  Plus,
  Search,
  Sparkles,
  Clock,
  MapPin,
  Ticket,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertCircle,
  Upload,
  User,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/custom-select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { fetchSpeakers, saveSpeaker, deleteSpeaker, type Speaker } from '@/lib/speakers'

const SESSION_TYPES = [
  'Keynote',
  'Panel',
  'Breakout',
  'Workshop',
  'Fireside Chat',
  'Lightning Talk',
  'Masterclass',
  'Other',
]

const TYPE_COLORS: Record<string, string> = {
  Keynote: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  Panel: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  Breakout: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Workshop: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'Fireside Chat': 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  'Lightning Talk': 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  Masterclass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
}

export default function SpeakersPage() {
  const params = useParams()
  const eventId = params.id as string

  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [designation, setDesignation] = useState('')
  const [bio, setBio] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [talkTitle, setTalkTitle] = useState('')
  const [sessionType, setSessionType] = useState('Keynote')
  const [stageRoom, setStageRoom] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [createPass, setCreatePass] = useState(true)

  // Photo direct upload state
  const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('upload')
  const [uploadingPhoto, setUploadingUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file (PNG, JPG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Speaker photo must be under 5MB.')
      return
    }

    setUploadingUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `speaker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const filePath = `speakers/${eventId}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
        if (publicUrlData?.publicUrl) {
          setPhotoUrl(publicUrlData.publicUrl)
          toast.success('Photo uploaded!')
          setUploadingUploadingPhoto(false)
          return
        }
      }

      // Base64 fallback
      const reader = new FileReader()
      reader.onload = () => {
        setPhotoUrl(reader.result as string)
        toast.success('Photo preview ready.')
        setUploadingUploadingPhoto(false)
      }
      reader.onerror = () => {
        toast.error('Could not read image file.')
        setUploadingUploadingPhoto(false)
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Error uploading photo.')
      setUploadingUploadingPhoto(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    const data = await fetchSpeakers(eventId)
    setSpeakers(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [eventId])

  const openAddModal = () => {
    setEditingSpeaker(null)
    setFullName('')
    setEmail('')
    setPhone('')
    setCompany('')
    setDesignation('')
    setBio('')
    setPhotoUrl('')
    setTalkTitle('')
    setSessionType('Keynote')
    setStageRoom('')
    setSessionTime('')
    setCreatePass(true)
    setShowModal(true)
  }

  const openEditModal = (speaker: Speaker) => {
    setEditingSpeaker(speaker)
    setFullName(speaker.full_name)
    setEmail(speaker.email || '')
    setPhone(speaker.phone || '')
    setCompany(speaker.company || '')
    setDesignation(speaker.designation || '')
    setBio(speaker.bio || '')
    setPhotoUrl(speaker.photo_url || '')
    setTalkTitle(speaker.talk_title || '')
    setSessionType(speaker.session_type || 'Keynote')
    setStageRoom(speaker.stage_room || '')
    setSessionTime(speaker.session_time || '')
    setCreatePass(false)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Speaker full name is required.')
      return
    }

    setSaving(true)
    try {
      await saveSpeaker(
        eventId,
        {
          id: editingSpeaker?.id,
          full_name: fullName,
          email,
          phone,
          company,
          designation,
          bio,
          photo_url: photoUrl,
          talk_title: talkTitle,
          session_type: sessionType,
          stage_room: stageRoom,
          session_time: sessionTime,
          registration_id: editingSpeaker?.registration_id,
        },
        createPass && !editingSpeaker
      )

      toast.success(editingSpeaker ? 'Speaker updated successfully.' : 'Speaker added to roster!')
      setShowModal(false)
      await loadData()
    } catch {
      toast.error('Could not save speaker. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (speaker: Speaker) => {
    if (!confirm(`Are you sure you want to remove speaker "${speaker.full_name}"?`)) return
    try {
      await deleteSpeaker(eventId, speaker.id)
      toast.success(`Removed ${speaker.full_name}`)
      setSpeakers((prev) => prev.filter((s) => s.id !== speaker.id))
    } catch {
      toast.error('Could not delete speaker.')
    }
  }

  // Filtered Speakers
  const filteredSpeakers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return speakers.filter((s) => {
      if (typeFilter !== 'all' && s.session_type !== typeFilter) return false
      if (!q) return true
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.company?.toLowerCase().includes(q) ||
        s.designation?.toLowerCase().includes(q) ||
        s.talk_title?.toLowerCase().includes(q) ||
        s.stage_room?.toLowerCase().includes(q)
      )
    })
  }, [speakers, search, typeFilter])

  // Statistics
  const keynotesCount = useMemo(() => speakers.filter((s) => s.session_type === 'Keynote').length, [speakers])
  const stagesCount = useMemo(
    () => new Set(speakers.map((s) => s.stage_room).filter(Boolean)).size,
    [speakers]
  )
  const passesLinkedCount = useMemo(() => speakers.filter((s) => !!s.registration_id || !!s.pass_code).length, [speakers])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              🎤 Speaker Management
            </h1>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
              {speakers.length} {speakers.length === 1 ? 'Speaker' : 'Speakers'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage keynote and session speakers, talk titles, stage schedules, and speaker check-in passes.
          </p>
        </div>

        <Button onClick={openAddModal} className="rounded-full gap-1.5 shadow-xs text-xs">
          <Plus size={14} />
          <span>Add Speaker</span>
        </Button>
      </div>

      {/* KPI Stat Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Speakers</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{speakers.length}</p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Keynote Speakers</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
            {keynotesCount}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Active Stages & Rooms</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{stagesCount}</p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Door Passes Linked</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {passesLinkedCount}
          </p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by speaker, talk topic, company, or stage..."
            className="pl-9 pr-8 rounded-full border-border bg-card text-xs h-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Session Type Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setTypeFilter('all')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-all shrink-0',
              typeFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground bg-card border border-border'
            )}
          >
            All Types
          </button>
          {SESSION_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition-all shrink-0',
                typeFilter === type
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground bg-card border border-border'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Speaker Cards Grid */}
      {loading ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
          <Mic className="mx-auto size-8 opacity-40 animate-pulse text-primary mb-2" />
          <p className="text-sm font-semibold">Loading speakers roster...</p>
        </div>
      ) : filteredSpeakers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Mic className="mx-auto size-10 opacity-30 text-muted-foreground mb-3" />
          <h3 className="text-base font-bold text-foreground">
            {search || typeFilter !== 'all' ? 'No speakers matching filters' : 'No speakers added yet'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            {search || typeFilter !== 'all'
              ? 'Try adjusting your search keywords or resetting the session type filter.'
              : 'Add keynote speakers, panelists, and workshop hosts. Each speaker gets talk attribution and a door check-in pass.'}
          </p>
          {!(search || typeFilter !== 'all') && (
            <Button onClick={openAddModal} size="sm" className="mt-4 rounded-full gap-1 text-xs">
              <Plus size={13} />
              <span>Add Your First Speaker</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSpeakers.map((speaker) => {
            const initials = speaker.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()

            const typeColor = TYPE_COLORS[speaker.session_type] || 'bg-muted text-muted-foreground border-border'

            return (
              <Card
                key={speaker.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Avatar & Session Type Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {speaker.photo_url ? (
                        <img
                          src={speaker.photo_url}
                          alt={speaker.full_name}
                          className="size-12 rounded-2xl object-cover border border-border shadow-2xs"
                        />
                      ) : (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-sm shadow-2xs">
                          {initials}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-foreground text-sm leading-snug">{speaker.full_name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {[speaker.designation, speaker.company].filter(Boolean).join(' • ') || 'Speaker'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        typeColor
                      )}
                    >
                      {speaker.session_type}
                    </span>
                  </div>

                  {/* Talk Title & Abstract */}
                  {speaker.talk_title ? (
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="text-xs font-semibold text-foreground line-clamp-2">
                        &ldquo;{speaker.talk_title}&rdquo;
                      </p>
                      {speaker.bio && (
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{speaker.bio}</p>
                      )}
                    </div>
                  ) : speaker.bio ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">{speaker.bio}</p>
                  ) : null}

                  {/* Schedule Details (Time & Stage) */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {speaker.session_time && (
                      <span className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 font-medium">
                        <Clock size={11} className="opacity-70" />
                        {speaker.session_time}
                      </span>
                    )}
                    {speaker.stage_room && (
                      <span className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 font-medium">
                        <MapPin size={11} className="opacity-70 text-primary" />
                        {speaker.stage_room}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer: Pass Status & Edit Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  {speaker.badge_token ? (
                    <Link
                      href={`/badge/${speaker.badge_token}`}
                      target="_blank"
                      className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <CheckCircle2 size={12} />
                      <span>Pass: {speaker.pass_code || 'Active'}</span>
                      <ExternalLink size={10} className="opacity-70" />
                    </Link>
                  ) : speaker.pass_code ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Ticket size={12} />
                      <span>Pass: {speaker.pass_code}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                      <AlertCircle size={11} className="opacity-60" />
                      No Pass Linked
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(speaker)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit Speaker"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(speaker)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Remove Speaker"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add / Edit Speaker Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                <Mic size={18} />
              </span>
              <div>
                <h3 className="font-extrabold text-foreground text-lg">
                  {editingSpeaker ? 'Edit Speaker' : 'Add New Speaker'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Speaker profile, session topic, stage, and badge attribution.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Speaker Basic Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Jenkins"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="speaker@company.com"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Company / Affiliation</label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. OpenAI / Stanford"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Designation / Role</label>
                  <Input
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. VP of Product"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              {/* Talk / Session Details */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Talk / Session Title</label>
                <Input
                  value={talkTitle}
                  onChange={(e) => setTalkTitle(e.target.value)}
                  placeholder="e.g. Scaling Autonomous Agents in 2026"
                  className="text-xs h-9 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Session Type</label>
                  <CustomSelect
                    value={sessionType}
                    onChange={(v) => setSessionType(v)}
                    options={SESSION_TYPES.map((t) => ({
                      value: t,
                      label: t,
                      dot:
                        t === 'Keynote'
                          ? 'bg-purple-500'
                          : t === 'Panel'
                          ? 'bg-blue-500'
                          : t === 'Breakout'
                          ? 'bg-emerald-500'
                          : t === 'Workshop'
                          ? 'bg-amber-500'
                          : t === 'Fireside Chat'
                          ? 'bg-rose-500'
                          : 'bg-indigo-500',
                    }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Stage / Room</label>
                  <Input
                    value={stageRoom}
                    onChange={(e) => setStageRoom(e.target.value)}
                    placeholder="e.g. Main Auditorium"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Session Time</label>
                  <Input
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    placeholder="e.g. 10:00 AM - 10:45 AM"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              {/* Bio & Photo URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Short Bio / Overview</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief background or talk synopsis..."
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Headshot Photo Direct Upload with Live Preview */}
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Speaker Headshot Photo</label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPhotoMode('upload')}
                      className={cn(
                        'px-2 py-0.5 rounded-full font-medium transition-colors',
                        photoMode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoMode('url')}
                      className={cn(
                        'px-2 py-0.5 rounded-full font-medium transition-colors',
                        photoMode === 'url' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Paste URL
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted shadow-2xs flex items-center justify-center">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Speaker preview" className="size-full object-cover" />
                    ) : (
                      <User className="size-6 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {photoMode === 'upload' ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingPhoto}
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-xl text-xs gap-1.5 h-8"
                          >
                            <Upload size={12} />
                            <span>{uploadingPhoto ? 'Processing...' : 'Choose Device File'}</span>
                          </Button>
                          {photoUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPhotoUrl('')}
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Square headshot recommended (PNG, JPG, WebP up to 5MB).
                        </p>
                      </div>
                    ) : (
                      <Input
                        value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        placeholder="https://... headshot image URL"
                        className="text-xs h-8 rounded-xl font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Create Pass Option */}
              {!editingSpeaker && (
                <label className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/40 p-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createPass}
                    onChange={(e) => setCreatePass(e.target.checked)}
                    className="size-4 rounded text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-semibold text-foreground">
                      Issue attendee door pass automatically
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Adds this speaker to the guest roster with a unique QR code badge pass.
                    </p>
                  </div>
                </label>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  className="rounded-full text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving} className="rounded-full text-xs gap-1">
                  {saving ? 'Saving...' : editingSpeaker ? 'Save Changes' : 'Add Speaker'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
