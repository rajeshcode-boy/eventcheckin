'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LOGO_RULES } from '@/lib/images'
import ImageUpload from '@/components/ImageUpload'

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

  if (!org) return error ? <p className="alert-error">{error}</p> : <p>Loading organization...</p>

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Settings</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
        {org.name} • {eventCount} event{eventCount === 1 ? '' : 's'} • since{' '}
        {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>

      <div role="tablist" aria-label="Settings" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--color-border)', marginBottom: '24px' }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 4px',
              marginRight: '20px',
              fontSize: '14px',
              fontWeight: tab === t ? 600 : 500,
              color: tab === t ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'General' && (
        <div role="tabpanel">
          {!isAdmin && (
            <div className="alert-warning" style={{ marginBottom: '16px' }}>Only admins can change the organization profile.</div>
          )}

          <form onSubmit={saveName} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            <label htmlFor="org-name" style={{ fontWeight: 500 }}>Organization name</label>
            <input id="org-name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" required maxLength={120} disabled={!isAdmin} />
            {error && <div className="alert-error">{error}</div>}
            {notice && <div className="alert-success">{notice}</div>}
            <button type="submit" className="btn-primary" disabled={!isAdmin || saving || name.trim() === org.name} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving...' : 'Save name'}
            </button>
          </form>

          <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            These settings affect your entire organization. Please proceed with caution.
          </p>
          <div style={{ border: '1px solid var(--color-error-red)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--color-surface-muted)', padding: '10px 16px', borderBottom: '1px solid var(--color-error-red)' }}>
              <p style={{ fontWeight: 700, color: 'var(--color-error-red)', fontSize: '14px' }}>Danger Zone</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px' }}>Delete Organization</p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                  Permanently delete this organization and all its data. Not available yet — contact support if you need this.
                </p>
              </div>
              <button type="button" className="btn-secondary" disabled style={{ borderColor: 'var(--color-error-red)', color: 'var(--color-error-red)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
