'use client'

import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  fetchSponsors,
  saveSponsor,
  deleteSponsor,
  DEFAULT_TIER_SUGGESTIONS,
  type Sponsor,
} from '@/lib/sponsors'

export default function SponsorsPage() {
  const params = useParams()
  const eventId = params.id as string

  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)

  // Form Fields
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

  const loadData = async () => {
    setLoading(true)
    const data = await fetchSponsors(eventId)
    setSponsors(data)
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
    setShowModal(true)
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
    if (!confirm(`Are you sure you want to remove "${sponsor.name}"?`)) return
    try {
      await deleteSponsor(eventId, sponsor.id)
      toast.success(`Removed ${sponsor.name}`)
      setSponsors((prev) => prev.filter((s) => s.id !== sponsor.id))
    } catch {
      toast.error('Could not delete sponsor.')
    }
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
  const totalRepPasses = useMemo(() => sponsors.reduce((acc, s) => acc + (s.rep_pass_quota || 0), 0), [sponsors])

  return (
    <div className="space-y-6">
      {/* Page Header */}
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

        <Button onClick={openAddModal} className="rounded-full gap-1.5 shadow-xs text-xs">
          <Plus size={14} />
          <span>Add Sponsor</span>
        </Button>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Sponsors</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{sponsors.length}</p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Custom Tiers Active</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {uniqueTiers.length}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Booths / Tables Assigned</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{boothsAssignedCount}</p>
        </Card>
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Rep Passes Quota</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {totalRepPasses}
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

                        {/* Booth & Rep Pass Info */}
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

                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <Ticket size={11} />
                            <span>{sponsor.rep_pass_quota} Rep Passes</span>
                          </span>
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
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ID: {sponsor.id.slice(0, 8)}
                        </span>

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

      {/* Add / Edit Sponsor Modal */}
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
              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                <Briefcase size={18} />
              </span>
              <div>
                <h3 className="font-extrabold text-foreground text-lg">
                  {editingSponsor ? 'Edit Sponsor' : 'Add New Sponsor'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Custom tier naming, booth location, and representative pass quotas.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Company / Organization Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Cloud Corp"
                  className="text-xs h-9 rounded-xl font-medium"
                />
              </div>

              {/* Custom Tier Name & Suggestions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Custom Tier Name <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    Type your own name or click an example below
                  </span>
                </div>
                <Input
                  required
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  placeholder="e.g. Title Partner, Gold Sponsor, Powered By, Media Partner"
                  className="text-xs h-9 rounded-xl font-semibold text-blue-600 dark:text-blue-400"
                />

                {/* Example Suggestion Chips */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Example Tiers:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_TIER_SUGGESTIONS.map((sug) => (
                      <button
                        type="button"
                        key={sug}
                        onClick={() => setTier(sug)}
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all border',
                          tier === sug
                            ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50 font-bold'
                            : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Booth & Website */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Booth / Table Location</label>
                  <Input
                    value={boothNumber}
                    onChange={(e) => setBoothNumber(e.target.value)}
                    placeholder="e.g. Booth B-12 / Hall A"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Website URL</label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://company.com"
                    className="text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              {/* Staff Pass Quota & Logo URL */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Staff Pass Quota (Complimentary)
                  </label>
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Logo URL (Optional)</label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://... logo PNG/SVG"
                    className="text-xs h-9 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Primary Contact Person Details */}
              <div className="rounded-2xl border border-border/80 bg-muted/30 p-3 space-y-2.5">
                <p className="text-xs font-bold text-foreground">Sponsor Representative / Contact Person</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact Name"
                      className="text-xs h-8 rounded-lg bg-card"
                    />
                  </div>
                  <div>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Contact Email"
                      className="text-xs h-8 rounded-lg bg-card"
                    />
                  </div>
                  <div>
                    <Input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Phone"
                      className="text-xs h-8 rounded-lg bg-card"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Internal Notes / Requirements</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special booth power requirements, shipping notes..."
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
                <Button type="submit" size="sm" disabled={saving} className="rounded-full text-xs gap-1">
                  {saving ? 'Saving...' : editingSponsor ? 'Save Changes' : 'Add Sponsor'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
