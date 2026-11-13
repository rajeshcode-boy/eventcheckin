'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LOGO_RULES } from '@/lib/images'
import ImageUpload from '@/components/ImageUpload'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Calendar, CalendarDays, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react'

interface Organization {
  id: string
  name: string
  logo_path: string | null
  created_at: string
}

export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [name, setName] = useState('')
  const [eventCount, setEventCount] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).single()
      if (!profile) {
        setError('Your profile could not be loaded.')
        return
      }
      setIsAdmin(profile.role === 'admin')
      const [{ data: orgData }, { count }] = await Promise.all([
        supabase.from('organizations').select('id, name, logo_path, created_at').eq('id', profile.organization_id).single(),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
      ])
      if (!orgData) {
        setError('Your organization could not be loaded.')
        return
      }
      setOrg(orgData)
      setName(orgData.name)
      setEventCount(count ?? 0)
    }
    load()
  }, [])

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org) return
    setError('')
    setNotice('')
    if (!name.trim()) {
      setError('Organization name is required.')
      return
    }
    setSaving(true)
    const { data, error: updateError } = await supabase.from('organizations').update({ name: name.trim() }).eq('id', org.id).select('id')
    setSaving(false)
    if (updateError || !data?.length) {
      setError('Could not save. Only admins can edit the organization.')
      return
    }
    setOrg({ ...org, name: name.trim() })
    setNotice('Organization details updated successfully.')
  }

  const saveLogo = async (path: string | null) => {
    if (!org) return false
    const { data, error: updateError } = await supabase.from('organizations').update({ logo_path: path }).eq('id', org.id).select('id')
    if (updateError || !data?.length) return false
    setOrg({ ...org, logo_path: path })
    return true
  }

  if (!org) return error ? <Alert variant="error">{error}</Alert> : <p>Loading organization...</p>

  const formattedDate = new Date(org.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
      {/* Header with Title & Meta Badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={22} className="text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Organization Profile</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your company details, brand logo assets, and global event preferences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
            <CalendarDays size={13} className="mr-1.5 text-primary" />
            {eventCount} {eventCount === 1 ? 'Event' : 'Events'} Active
          </Badge>
          <Badge variant="outline" className="px-3 py-1 text-xs font-medium text-muted-foreground">
            Member since {formattedDate}
          </Badge>
        </div>
      </div>

      {!isAdmin && (
        <Alert variant="warning">
          You are viewing this organization as staff. Only organization administrators can modify these details.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left Column: Company Logo & Brand Asset Card */}
        <div className="space-y-6 md:col-span-1">
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Company Brand Logo
              </h2>
            </div>
            <div className="flex flex-col items-center text-center">
              <ImageUpload
                mode="saved"
                label="Company logo"
                shape="logo"
                rules={LOGO_RULES}
                bucket="branding"
                folder={`${org.id}/organization`}
                kind="logo"
                path={org.logo_path}
                onSave={saveLogo}
                disabled={!isAdmin}
                hint="Used as default header logo across your badges, attendee pass emails, and kiosks."
              />
            </div>
          </Card>

          {/* Quick Info Box */}
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              About Organization Assets
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your organization logo automatically populates new event creations. Individual events can still override with custom event banners and logos.
            </p>
          </Card>
        </div>

        {/* Right Column: Name & Danger Zone */}
        <div className="space-y-6 md:col-span-2">
          {/* General Details Form */}
          <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-foreground mb-1">Company Details</h2>
            <p className="text-xs text-muted-foreground mb-6">
              This name is shown to guests and badge holders across all events.
            </p>

            <form onSubmit={saveName} className="space-y-5">
              <div>
                <label htmlFor="org-name" className="mb-2 block font-medium text-sm text-foreground">
                  Organization Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="org-name"
                  className="h-11 rounded-xl text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  disabled={!isAdmin}
                  placeholder="e.g. Acme Conferences Inc."
                />
              </div>

              {error && <Alert variant="error">{error}</Alert>}
              {notice && <Alert variant="success">{notice}</Alert>}

              {isAdmin && (
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="rounded-full bg-primary font-semibold text-primary-foreground shadow-xs"
                    disabled={saving || name.trim() === org.name}
                  >
                    {saving ? 'Saving changes...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </form>
          </Card>

          {/* Danger Zone */}
          <Card className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-destructive">
              <AlertTriangle size={20} />
              <h2 className="text-base font-bold">Danger Zone</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Permanently delete this organization, along with all associated events, badges, check-in history, and attendee rosters.
            </p>
            <div className="flex items-center justify-between border-t border-destructive/20 pt-4">
              <span className="text-xs text-muted-foreground font-medium">
                Self-service deletion is locked to prevent accidental data loss.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-destructive/40 text-destructive opacity-60"
                disabled
              >
                Delete Organization
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
