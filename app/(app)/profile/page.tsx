'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AVATAR_RULES } from '@/lib/images'
import ImageUpload from '@/components/ImageUpload'
import PhoneInput from '@/components/PhoneInput'
import PushNotifications from '@/components/PushNotifications'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

const labelClass = 'mb-2 block font-medium'
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

  if (!profile) return error ? <Alert variant="error">{error}</Alert> : <p>Loading profile...</p>

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <div>
        <h1 className="mb-2 text-[28px] font-bold">My Profile</h1>
        <p className="text-muted-foreground">Your personal account. Company details are under Organization.</p>
      </div>

      <div className="rounded-md border border-border p-4">
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

      <form onSubmit={save} className="flex flex-col gap-4 rounded-md border border-border p-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <div>
          <label htmlFor="p-name" className={labelClass}>Full name *</label>
          <Input id="p-name" className="h-10" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
        </div>
        <div>
          <label htmlFor="p-phone" className={labelClass}>Phone</label>
          <PhoneInput id="p-phone" value={phone} onChange={setPhone} defaultCountryIso="IN" />
        </div>
        <div>
          <label htmlFor="p-designation" className={labelClass}>Designation</label>
          <Input id="p-designation" className="h-10" value={designation} onChange={(e) => setDesignation(e.target.value)} maxLength={120} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{authEmail || profile.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="capitalize">{profile.role}</dd>
          <dt className="text-muted-foreground">Account created</dt>
          <dd>{formatDate(profile.created_at)}</dd>
          <dt className="text-muted-foreground">Last sign-in</dt>
          <dd>{formatDate(lastSignIn)}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">Email and role can&apos;t be changed here.</p>
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}
        <Button type="submit" className="self-start" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</Button>
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
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-md border border-border p-4">
      <h2 className="text-lg font-semibold">Change password</h2>
      <div>
        <label htmlFor="pw-current" className={labelClass}>Current password</label>
        <Input id="pw-current" type="password" className="h-10" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="pw-new" className={labelClass}>New password</label>
        <Input id="pw-new" type="password" className="h-10" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label htmlFor="pw-confirm" className={labelClass}>Confirm new password</label>
        <Input id="pw-confirm" type="password" className="h-10" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      <Button type="submit" className="self-start" disabled={saving || !email}>{saving ? 'Changing...' : 'Change password'}</Button>
    </form>
  )
}
