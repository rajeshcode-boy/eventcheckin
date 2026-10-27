'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AVATAR_RULES } from '@/lib/images'
import ImageUpload from '@/components/ImageUpload'
import PhoneInput from '@/components/PhoneInput'
import PushNotifications from '@/components/PushNotifications'

interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  designation: string | null
  role: 'admin' | 'staff'
  // Path in the `avatars` bucket
  profile_photo_url: string | null
  created_at: string
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', fontWeight: 500 }
const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// The signed-in user's own profile. Role, organization and email can't be changed
// here (a database trigger also blocks it).
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [lastSignIn, setLastSignIn] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setAuthEmail(user.email ?? '')
      setLastSignIn(user.last_sign_in_at ?? null)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, designation, role, profile_photo_url, created_at')
        .eq('id', user.id)
        .single()
      if (!data) {
        setError('Your profile could not be loaded.')
        return
      }
      setProfile(data as Profile)
      setFullName(data.full_name)
      setPhone(data.phone ?? '')
      setDesignation(data.designation ?? '')
    }
    load()
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setError('')
    setNotice('')
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null, designation: designation.trim() || null })
      .eq('id', profile.id)
    setSaving(false)
    if (updateError) {
      setError('Could not save: ' + updateError.message)
      return
    }
    setProfile({ ...profile, full_name: fullName.trim(), phone: phone.trim() || null, designation: designation.trim() || null })
    setNotice('Profile saved.')
  }

  const savePhoto = async (path: string | null) => {
    if (!profile) return false
    const { error: updateError } = await supabase.from('profiles').update({ profile_photo_url: path }).eq('id', profile.id)
    if (updateError) return false
    setProfile({ ...profile, profile_photo_url: path })
    // Let the header refresh its avatar
    window.dispatchEvent(new Event('profile-updated'))
    return true
  }

  if (!profile) return error ? <p className="alert-error">{error}</p> : <p>Loading profile...</p>

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>My Profile</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Your personal account. Company details are under Organization.</p>
      </div>

      <div style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
        <ImageUpload
          mode="saved"
          label="Profile photo"
          shape="avatar"
          rules={AVATAR_RULES}
          bucket="avatars"
          folder={profile.id}
          kind="photo"
          path={profile.profile_photo_url}
          onSave={savePhoto}
          hint="A square photo works best."
        />
      </div>

      <PushNotifications mode="organizer" />

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Details</h2>
        <div>
          <label htmlFor="p-name" style={labelStyle}>Full name *</label>
          <input id="p-name" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
        </div>
        <div>
          <label htmlFor="p-phone" style={labelStyle}>Phone</label>
          <PhoneInput id="p-phone" value={phone} onChange={setPhone} defaultCountryIso="IN" />
        </div>
        <div>
          <label htmlFor="p-designation" style={labelStyle}>Designation</label>
          <input id="p-designation" className="input-field" value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} />
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '14px' }}>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Email</dt>
          <dd>{authEmail || profile.email}</dd>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Role</dt>
          <dd style={{ textTransform: 'capitalize' }}>{profile.role}</dd>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Account created</dt>
          <dd>{formatDate(profile.created_at)}</dd>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Last sign-in</dt>
          <dd>{formatDate(lastSignIn)}</dd>
        </dl>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Email and role can&apos;t be changed here.</p>
        {error && <div className="alert-error">{error}</div>}
        {notice && <div className="alert-success">{notice}</div>}
        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>{saving ? 'Saving...' : 'Save profile'}</button>
      </form>

      <ChangePassword email={authEmail} />
    </div>
  )
}

function ChangePassword({ email }: { email: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmNext, setConfirmNext] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (next.length < 8) {
      setError('The new password must be at least 8 characters.')
      return
    }
    if (next !== confirmNext) {
      setError('The new passwords do not match.')
      return
    }
    if (next === current) {
      setError('Choose a password different from the current one.')
      return
    }
    setSaving(true)
    // Confirm the current password before changing it
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInError) {
      setSaving(false)
      setError('The current password is incorrect.')
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    setSaving(false)
    if (updateError) {
      setError('Could not change the password: ' + updateError.message)
      return
    }
    setCurrent('')
    setNext('')
    setConfirmNext('')
    setNotice('Password changed.')
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Change password</h2>
      <div>
        <label htmlFor="pw-current" style={labelStyle}>Current password</label>
        <input id="pw-current" type="password" className="input-field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="pw-new" style={labelStyle}>New password</label>
        <input id="pw-new" type="password" className="input-field" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label htmlFor="pw-confirm" style={labelStyle}>Confirm new password</label>
        <input id="pw-confirm" type="password" className="input-field" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-success">{notice}</div>}
      <button type="submit" className="btn-primary" disabled={saving || !email} style={{ alignSelf: 'flex-start' }}>{saving ? 'Changing...' : 'Change password'}</button>
    </form>
  )
}
