'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Briefcase,
  Plus,
  Search,
  Sparkles,
  MapPin,
  ExternalLink,
  Ticket,
  Mail,
  Phone,
  Edit2,
  Trash2,
  X,
  Layers,
  Building2,
  Award,
  Users,
  CheckCircle2,
  Clock,
  Download,
  ShieldCheck,
  Upload,
  Copy,
  Check,
  UserPlus,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  fetchSponsors,
  saveSponsor,
  deleteSponsor,
  fetchSponsorReps,
  saveSponsorRep,
  deleteSponsorRep,
  checkInSponsorRep,
  undoSponsorRepCheckIn,
  exportSponsorRepsToCsv,
  DEFAULT_TIER_SUGGESTIONS,
  type Sponsor,
  type SponsorRep,
} from '@/lib/sponsors'

export default function SponsorsPage() {
  const params = useParams()
  const eventId = params.id as string

  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [sponsorReps, setSponsorReps] = useState<SponsorRep[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')

  // Sponsor Add/Edit Modal State
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)

  // Sponsor Form Fields
  const [name, setName] = useState('')
  const [tier, setTier] = useState('')
  const [boothNumber, setBoothNumber] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [repQuota, setRepQuota] = useState(2)
  const [notes, setNotes] = useState('')

  // Logo file upload state
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Booth Reps Management Modal State
  const [selectedSponsorForReps, setSelectedSponsorForReps] = useState<Sponsor | null>(null)
  const [repName, setRepName] = useState('')
  const [repRole, setRepRole] = useState('Booth Staff')
  const [repEmail, setRepEmail] = useState('')
  const [repPhone, setRepPhone] = useState('')
  const [savingRep, setSavingRep] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [sponsorsData, repsData] = await Promise.all([
      fetchSponsors(eventId),
      fetchSponsorReps(eventId),
    ])
    setSponsors(sponsorsData)
    setSponsorReps(repsData)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [eventId])

  const openAddModal = () => {
    setEditingSponsor(null)
    setName('')
    setTier('Gold Sponsor')
    setBoothNumber('')
    setWebsite('')
    setLogoUrl('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setRepQuota(2)
    setNotes('')
    setLogoMode('upload')
    setShowModal(true)
  }

  const openEditModal = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor)
    setName(sponsor.name)
    setTier(sponsor.tier)
    setBoothNumber(sponsor.booth_number || '')
    setWebsite(sponsor.website || '')
    setLogoUrl(sponsor.logo_url || '')
    setContactName(sponsor.contact_name || '')
    setContactEmail(sponsor.contact_email || '')
    setContactPhone(sponsor.contact_phone || '')
    setRepQuota(sponsor.rep_pass_quota || 2)
    setNotes(sponsor.notes || '')
    setLogoMode(sponsor.logo_url?.startsWith('data:') || !sponsor.logo_url ? 'upload' : 'url')
    setShowModal(true)
  }

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file (PNG, JPG, SVG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo image must be under 5MB.')
      return
    }

    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `sponsor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const filePath = `sponsors/${eventId}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file, { upsert: true })

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('branding').getPublicUrl(filePath)
        if (publicUrlData?.publicUrl) {
          setLogoUrl(publicUrlData.publicUrl)
          toast.success('Logo uploaded!')
          setUploadingLogo(false)
          return
        }
      }

      // Base64 fallback
      const reader = new FileReader()
      reader.onload = () => {
        setLogoUrl(reader.result as string)
        toast.success('Logo loaded preview.')
        setUploadingLogo(false)
      }
      reader.onerror = () => {
        toast.error('Could not read image file.')
        setUploadingLogo(false)
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Error uploading logo.')
      setUploadingLogo(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Company / Sponsor name is required.')
      return
    }
    if (!tier.trim()) {
      toast.error('Please enter or select a sponsor tier.')
      return
    }

    setSaving(true)
    try {
      await saveSponsor(eventId, {
        id: editingSponsor?.id,
        name,
        tier: tier.trim(),
        booth_number: boothNumber,
        website,
        logo_url: logoUrl,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        rep_pass_quota: repQuota,
        notes,
      })

      toast.success(editingSponsor ? 'Sponsor updated successfully.' : 'Sponsor added successfully!')
      setShowModal(false)
      await loadData()
    } catch {
      toast.error('Could not save sponsor.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (sponsor: Sponsor) => {
    if (!confirm(`Are you sure you want to remove "${sponsor.name}"? This will also remove any assigned booth passes.`)) return
    try {
      await deleteSponsor(eventId, sponsor.id)
      toast.success(`Removed ${sponsor.name}`)
      setSponsors((prev) => prev.filter((s) => s.id !== sponsor.id))
      setSponsorReps((prev) => prev.filter((r) => r.sponsor_id !== sponsor.id))
    } catch {
      toast.error('Could not delete sponsor.')
    }
  }

  // Booth Reps Functions
  const handleOpenRepsModal = (sponsor: Sponsor) => {
    setSelectedSponsorForReps(sponsor)
    setRepName('')
    setRepRole('Booth Staff')
    setRepEmail('')
    setRepPhone('')
  }

  const handleAddRep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSponsorForReps) return
    if (!repName.trim()) {
      toast.error('Please enter the representative full name.')
      return
    }

    setSavingRep(true)
    try {
      const newRep = await saveSponsorRep(eventId, selectedSponsorForReps.id, {
        full_name: repName.trim(),
        role_title: repRole.trim() || 'Booth Staff',
        email: repEmail.trim() || null,
        phone: repPhone.trim() || null,
      })

      setSponsorReps((prev) => [...prev, newRep])
      setRepName('')
      setRepRole('Booth Staff')
      setRepEmail('')
      setRepPhone('')
      toast.success(`Issued booth pass for ${newRep.full_name} (${newRep.pass_code})`)
    } catch {
      toast.error('Could not save representative.')
    } finally {
      setSavingRep(false)
    }
  }

  const handleDeleteRep = async (rep: SponsorRep) => {
    if (!confirm(`Remove booth pass for ${rep.full_name}?`)) return
    try {
      await deleteSponsorRep(rep.id, eventId)
      setSponsorReps((prev) => prev.filter((r) => r.id !== rep.id))
      toast.info(`Removed pass for ${rep.full_name}`)
    } catch {
      toast.error('Could not remove pass.')
    }
  }

  const handleToggleRepCheckin = async (rep: SponsorRep) => {
    try {
      if (rep.checked_in_at) {
        const updated = await undoSponsorRepCheckIn(rep.id, eventId)
        if (updated) {
          setSponsorReps((prev) => prev.map((r) => (r.id === rep.id ? updated : r)))
          toast.info(`Undid check-in for ${rep.full_name}`)
        }
      } else {
        const updated = await checkInSponsorRep(rep.id, eventId, 'Organizer Desk', 'manual')
        if (updated) {
          setSponsorReps((prev) => prev.map((r) => (r.id === rep.id ? updated : r)))
          toast.success(`✓ Checked in ${rep.full_name}`)
        }
      }
    } catch {
      toast.error('Error updating attendance.')
    }
  }

  const copyPassLink = (rep: SponsorRep) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/pass/${rep.badge_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(rep.id)
      setTimeout(() => setCopiedCode((id) => (id === rep.id ? null : id)), 1800)
      toast.success(`Copied pass link for ${rep.full_name}`)
    })
  }

  // Export Sponsor Team CSV (Strictly Segregated from Guest List)
  const handleExportSponsorReps = () => {
    if (sponsorReps.length === 0) {
      toast.info('No sponsor representatives to export yet. Add booth reps first.')
      return
    }

    const csvContent = exportSponsorRepsToCsv(sponsors, sponsorReps)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sponsors-delegation-passes-${Date.now()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Exported sponsor delegation CSV! Notice: Sponsor contacts remain strictly segregated from guest list.')
  }

  // Active Unique Tiers in this event
  const uniqueTiers = useMemo(() => {
    const set = new Set(sponsors.map((s) => s.tier).filter(Boolean))
    return Array.from(set)
  }, [sponsors])

  // Filtered Sponsors
  const filteredSponsors = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sponsors.filter((s) => {
      if (tierFilter !== 'all' && s.tier !== tierFilter) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.tier.toLowerCase().includes(q) ||
        s.booth_number?.toLowerCase().includes(q) ||
        s.contact_name?.toLowerCase().includes(q)
      )
    })
  }, [sponsors, search, tierFilter])

  // Grouped by Tier
  const groupedByTier = useMemo(() => {
    const map: Record<string, Sponsor[]> = {}
    for (const s of filteredSponsors) {
      const t = s.tier || 'Other Partner'
      if (!map[t]) map[t] = []
      map[t].push(s)
    }
    return map
  }, [filteredSponsors])

  // Statistics
  const boothsAssignedCount = useMemo(() => sponsors.filter((s) => !!s.booth_number).length, [sponsors])
  const totalRepPassesQuota = useMemo(() => sponsors.reduce((acc, s) => acc + (s.rep_pass_quota || 0), 0), [sponsors])
  const totalAssignedReps = sponsorReps.length
  const totalCheckedInReps = useMemo(() => sponsorReps.filter((r) => !!r.checked_in_at).length, [sponsorReps])

  const selectedSponsorReps = useMemo(() => {
    if (!selectedSponsorForReps) return []
    return sponsorReps.filter((r) => r.sponsor_id === selectedSponsorForReps.id)
  }, [sponsorReps, selectedSponsorForReps])

  return (
    <div className="space-y-6">
      {/* Page Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              💼 Sponsor & Partner Hub
            </h1>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-500/20">
              {sponsors.length} {sponsors.length === 1 ? 'Sponsor' : 'Sponsors'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage your event sponsors, custom tier naming, exhibition booth allocations, and staff representative passes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sponsorReps.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSponsorReps}
              className="rounded-full gap-1.5 text-xs"
              title="Download sponsor representatives CSV (Separate from general attendees)"
            >
              <Download size={13} />
              <span>Export Sponsor Team (CSV)</span>
            </Button>
          )}

          <Button onClick={openAddModal} className="rounded-full gap-1.5 shadow-xs text-xs">
            <Plus size={14} />
            <span>Add Sponsor</span>
          </Button>
        </div>
      </div>

      {/* Privacy Isolation Notice Pill */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <ShieldCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p>
          <strong className="text-foreground">Contact Privacy Protection:</strong> Sponsor booth representatives and contact details are kept strictly segregated in this dedicated hub. They are never mixed into your general attendee roster downloads.
        </p>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Sponsors</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{sponsors.length}</p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Custom Tiers</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {uniqueTiers.length}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Booths Assigned</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{boothsAssignedCount}</p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Staff Passes & Attendance</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
            <span className="text-emerald-600 dark:text-emerald-400">{totalCheckedInReps}</span>
            <span className="text-sm font-normal text-muted-foreground"> / {totalAssignedReps} arrived</span>
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
            placeholder="Search by company, tier, booth number, or contact person..."
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

        {/* Tier Filter Chips */}
        {uniqueTiers.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setTierFilter('all')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-all shrink-0',
                tierFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground bg-card border border-border'
              )}
            >
              All Tiers
            </button>
            {uniqueTiers.map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold transition-all shrink-0',
                  tierFilter === t
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground bg-card border border-border'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sponsors Content */}
      {loading ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
          <Briefcase className="mx-auto size-8 opacity-40 animate-pulse text-primary mb-2" />
          <p className="text-sm font-semibold">Loading sponsors & partners...</p>
        </div>
      ) : filteredSponsors.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Briefcase className="mx-auto size-10 opacity-30 text-muted-foreground mb-3" />
          <h3 className="text-base font-bold text-foreground">
            {search || tierFilter !== 'all' ? 'No sponsors matching filters' : 'No sponsors added yet'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            {search || tierFilter !== 'all'
              ? 'Try adjusting your search keywords or resetting the tier filter.'
              : 'Add your event sponsors with custom tier names, booth numbers, and staff pass quotas.'}
          </p>
          {!(search || tierFilter !== 'all') && (
            <Button onClick={openAddModal} size="sm" className="mt-4 rounded-full gap-1 text-xs">
              <Plus size={13} />
              <span>Add Your First Sponsor</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByTier).map(([tierName, tierSponsors]) => (
            <div key={tierName} className="space-y-3">
              {/* Group Tier Section Header */}
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  <Award size={13} className="text-blue-600 dark:text-blue-400" />
                  <span>{tierName}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  ({tierSponsors.length} {tierSponsors.length === 1 ? 'partner' : 'partners'})
                </span>
              </div>

              {/* Grid of Sponsors in this Tier */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tierSponsors.map((sponsor) => {
                  const reps = sponsorReps.filter((r) => r.sponsor_id === sponsor.id)
                  const checkedInCount = reps.filter((r) => !!r.checked_in_at).length
                  const initials = sponsor.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()

                  return (
                    <Card
                      key={sponsor.id}
                      className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="space-y-3.5">
                        {/* Company Logo & Name Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {sponsor.logo_url ? (
                              <img
                                src={sponsor.logo_url}
                                alt={sponsor.name}
                                className="size-12 rounded-2xl object-contain p-1 border border-border bg-white dark:bg-card shadow-2xs"
                              />
                            ) : (
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-sm shadow-2xs">
                                {initials}
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold text-foreground text-sm leading-snug">{sponsor.name}</h3>
                              {sponsor.website && (
                                <a
                                  href={sponsor.website.startsWith('http') ? sponsor.website : `https://${sponsor.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <span>{sponsor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                                  <ExternalLink size={10} className="opacity-70" />
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Tier Badge */}
                          <span className="shrink-0 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            {sponsor.tier}
                          </span>
                        </div>

                        {/* Booth & Rep Pass Allocation Summary */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {sponsor.booth_number ? (
                            <span className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 font-medium text-foreground">
                              <MapPin size={11} className="text-primary" />
                              <span>{sponsor.booth_number}</span>
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted/40 px-2.5 py-0.5 text-muted-foreground text-[10px]">
                              Booth TBA
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenRepsModal(sponsor)}
                            className="flex items-center gap-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-0.5 font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-colors cursor-pointer"
                            title="Manage booth team and passes"
                          >
                            <Ticket size={11} />
                            <span>
                              {reps.length} / {sponsor.rep_pass_quota} Passes
                            </span>
                            {checkedInCount > 0 && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold ml-0.5">
                                ({checkedInCount} arrived)
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Contact Person */}
                        {(sponsor.contact_name || sponsor.contact_email) && (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground space-y-0.5">
                            {sponsor.contact_name && (
                              <p className="font-semibold text-foreground">{sponsor.contact_name}</p>
                            )}
                            {sponsor.contact_email && (
                              <p className="flex items-center gap-1 text-[11px]">
                                <Mail size={10} className="opacity-70" />
                                <span>{sponsor.contact_email}</span>
                              </p>
                            )}
                          </div>
                        )}

                        {sponsor.notes && (
                          <p className="text-[11px] text-muted-foreground italic line-clamp-2">{sponsor.notes}</p>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRepsModal(sponsor)}
                          className="h-7 rounded-lg text-xs gap-1 text-primary hover:bg-primary/10 px-2 font-medium"
                        >
                          <Users size={12} />
                          <span>Manage Passes ({reps.length})</span>
                        </Button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(sponsor)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Edit Sponsor"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(sponsor)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Remove Sponsor"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT SPONSOR MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground">
                {editingSponsor ? 'Edit Sponsor & Partner' : 'Add New Sponsor / Partner'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
              {/* Sponsor Name & Tier */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Company Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Google Cloud, Stripe"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Sponsor Tier <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    placeholder="Type or select a tier below"
                    className="text-xs h-9 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Tier Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Quick Tier Suggestions:</span>
                <div className="flex flex-wrap gap-1">
                  {DEFAULT_TIER_SUGGESTIONS.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setTier(t)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border',
                        tier === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Booth & Passes Quota */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Booth / Table Allocation</label>
                  <Input
                    value={boothNumber}
                    onChange={(e) => setBoothNumber(e.target.value)}
                    placeholder="e.g. Booth A-12, Main Expo Hall"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Staff Passes Quota</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={repQuota}
                    onChange={(e) => setRepQuota(Number(e.target.value))}
                    placeholder="2"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              {/* Website */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Website URL</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="text-xs h-9 rounded-xl font-mono"
                />
              </div>

              {/* Logo Upload with Live Preview */}
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Company Logo</label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLogoMode('upload')}
                      className={cn(
                        'px-2 py-0.5 rounded-full font-medium transition-colors',
                        logoMode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoMode('url')}
                      className={cn(
                        'px-2 py-0.5 rounded-full font-medium transition-colors',
                        logoMode === 'url' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Paste URL
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-white dark:bg-card p-1 shadow-2xs flex items-center justify-center">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo preview" className="size-full object-contain" />
                    ) : (
                      <Building2 className="size-6 text-muted-foreground/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {logoMode === 'upload' ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingLogo}
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-xl text-xs gap-1.5 h-8"
                          >
                            <Upload size={12} />
                            <span>{uploadingLogo ? 'Processing...' : 'Choose Device File'}</span>
                          </Button>
                          {logoUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setLogoUrl('')}
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          PNG, JPG, SVG or WebP up to 5MB.
                        </p>
                      </div>
                    ) : (
                      <Input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://... logo image link"
                        className="text-xs h-8 rounded-xl font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Contact Person */}
              <div className="rounded-2xl border border-border/80 bg-muted/10 p-3 space-y-2.5">
                <span className="text-[11px] font-semibold text-foreground">
                  Primary Sponsor Account Contact (Internal)
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact Name"
                    className="text-xs h-8 rounded-xl"
                  />
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className="text-xs h-8 rounded-xl"
                  />
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="text-xs h-8 rounded-xl"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Deliverables & Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Needs power strip at booth, 2 roll-up banners permitted..."
                  className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

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
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="rounded-full text-xs"
                >
                  {saving ? 'Saving...' : editingSponsor ? 'Save Changes' : 'Add Sponsor'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: MANAGE SPONSOR BOOTH REPRESENTATIVES & PASSES */}
      {selectedSponsorForReps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {selectedSponsorForReps.name} — Booth Staff & Representative Passes
                  </h2>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    {selectedSponsorForReps.tier}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Booth allocation: <strong className="text-foreground">{selectedSponsorForReps.booth_number || 'TBA'}</strong> &bull; Quota: <strong className="text-foreground">{selectedSponsorForReps.rep_pass_quota} Passes</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSponsorForReps(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quota Progress Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3.5 text-xs">
              <div className="flex items-center gap-3">
                <Ticket className="size-5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedSponsorReps.length} of {selectedSponsorForReps.rep_pass_quota} Passes Assigned
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedSponsorReps.filter((r) => !!r.checked_in_at).length} reps have checked in at the venue.
                  </p>
                </div>
              </div>

              {selectedSponsorReps.length >= selectedSponsorForReps.rep_pass_quota && (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Quota Reached
                </span>
              )}
            </div>

            {/* Form: Add New Representative */}
            <form onSubmit={handleAddRep} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <UserPlus size={14} className="text-primary" />
                <span>Issue Representative Pass</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Rep Full Name *</label>
                  <Input
                    required
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="text-xs h-8 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Role / Title</label>
                  <Input
                    value={repRole}
                    onChange={(e) => setRepRole(e.target.value)}
                    placeholder="e.g. Booth Lead, Demo Specialist"
                    className="text-xs h-8 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Email Address</label>
                  <Input
                    type="email"
                    value={repEmail}
                    onChange={(e) => setRepEmail(e.target.value)}
                    placeholder="rep@company.com"
                    className="text-xs h-8 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">Phone Number</label>
                  <Input
                    value={repPhone}
                    onChange={(e) => setRepPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="text-xs h-8 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Contacts stay strictly inside this sponsor hub and are never added to attendee downloads.
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingRep}
                  className="rounded-full text-xs h-8 gap-1.5"
                >
                  <Plus size={12} />
                  <span>{savingRep ? 'Issuing...' : 'Issue Pass'}</span>
                </Button>
              </div>
            </form>

            {/* List of Issued Rep Passes */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-foreground">
                Assigned Booth Team ({selectedSponsorReps.length})
              </h3>

              {selectedSponsorReps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                  No representative passes issued yet for {selectedSponsorForReps.name}. Use the form above to assign a pass.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                  {selectedSponsorReps.map((rep) => {
                    const isCheckedIn = !!rep.checked_in_at
                    return (
                      <div
                        key={rep.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{rep.full_name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.2 text-[10px] font-medium text-muted-foreground">
                              {rep.role_title}
                            </span>
                            <code className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                              {rep.pass_code}
                            </code>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            {rep.email && <span>{rep.email}</span>}
                            {rep.phone && <span>{rep.phone}</span>}
                            <span>
                              {isCheckedIn ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  ✓ Checked in {new Date(rep.checked_in_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">○ Not arrived yet</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyPassLink(rep)}
                            className="h-7 rounded-lg text-xs gap-1 px-2.5"
                            title="Copy digital badge link"
                          >
                            {copiedCode === rep.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            <span>{copiedCode === rep.id ? 'Copied' : 'Pass Link'}</span>
                          </Button>

                          <Button
                            variant={isCheckedIn ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleToggleRepCheckin(rep)}
                            className={cn(
                              'h-7 rounded-lg text-xs gap-1 px-2.5 font-semibold',
                              isCheckedIn
                                ? 'text-muted-foreground hover:text-foreground'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            )}
                          >
                            {isCheckedIn ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
                            <span>{isCheckedIn ? 'Undo' : 'Check In'}</span>
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRep(rep)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Remove pass"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSponsorForReps(null)}
                className="rounded-full text-xs"
              >
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
