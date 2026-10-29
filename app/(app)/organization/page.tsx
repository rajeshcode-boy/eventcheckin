'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LOGO_RULES } from '@/lib/images'
import ImageUpload from '@/components/ImageUpload'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Organization {
  id: string
  name: string
  logo_path: string | null
  created_at: string
}

const TABS = ['General', 'Advanced'] as const
type Tab = (typeof TABS)[number]

// Organizer company profile: name and logo. Event pages and badges use this
// logo unless the event has its own.
export default function OrganizationPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [name, setName] = useState('')
  const [eventCount, setEventCount] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('General')

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
    setNotice('Organization saved.')
  }

  const saveLogo = async (path: string | null) => {
    if (!org) return false
    const { data, error: updateError } = await supabase.from('organizations').update({ logo_path: path }).eq('id', org.id).select('id')
    if (updateError || !data?.length) return false
    setOrg({ ...org, logo_path: path })
    return true
  }

  if (!org) return error ? <Alert variant="error">{error}</Alert> : <p>Loading organization...</p>

  return (
    <div className="max-w-[640px]">
      <h1 className="mb-2 text-[28px] font-bold">Settings</h1>
      <p className="mb-5 text-muted-foreground">
        {org.name} • {eventCount} event{eventCount === 1 ? '' : 's'} • since{' '}
        {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>

      <div role="tablist" aria-label="Settings" className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'mr-5 border-b-2 bg-transparent px-1 py-2.5 text-sm',
              tab === t ? 'border-primary font-semibold text-primary' : 'border-transparent font-medium text-muted-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' && (
        <div role="tabpanel">
          {!isAdmin && (
            <Alert variant="warning" className="mb-4">Only admins can change the organization profile.</Alert>
          )}

          <form onSubmit={saveName} className="mb-8 flex flex-col gap-3">
            <label htmlFor="org-name" className="font-medium">Organization name</label>
            <Input id="org-name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} disabled={!isAdmin} />
            {error && <Alert variant="error">{error}</Alert>}
            {notice && <Alert variant="success">{notice}</Alert>}
            <Button type="submit" className="self-start" disabled={!isAdmin || saving || name.trim() === org.name}>
              {saving ? 'Saving...' : 'Save name'}
            </Button>
          </form>

          <div className="rounded-md border border-border p-4">
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
              hint="Used on your event pages and badges when an event has no logo of its own. A square or wide PNG with a transparent background works best."
            />
          </div>
        </div>
      )}

      {tab === 'Advanced' && (
        <div role="tabpanel">
          <p className="mb-4 text-sm text-muted-foreground">
            These settings affect your entire organization. Please proceed with caution.
          </p>
          <div className="overflow-hidden rounded-[10px] border border-destructive">
            <div className="border-b border-destructive bg-secondary px-4 py-2.5">
              <p className="text-sm font-bold text-destructive">Danger Zone</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-semibold">Delete Organization</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Permanently delete this organization and all its data. Not available yet — contact support if you need this.
                </p>
              </div>
              <Button type="button" variant="outline" className="border-destructive text-destructive" disabled>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
