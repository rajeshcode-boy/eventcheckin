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
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, ShieldCheck, Mail, Calendar, Clock, KeyRound, Bell } from 'lucide-react'

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
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
      {/* Header Profile Title & Meta */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Account Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your personal settings, login credentials, and notification preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 font-semibold capitalize text-xs">
            <ShieldCheck size={14} className="mr-1 text-primary" />
            {profile.role} Account
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Left Column: Photo & Notifications */}
        <div className="space-y-6 md:col-span-1">
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <h2 className="mb-4 text-sm font-bold tracking-wide uppercase text-muted-foreground">
              Profile Photo
            </h2>
            <div className="flex flex-col items-center text-center">
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
                hint="Square JPG or PNG, max 2 MB."
              />
            </div>
          </Card>

          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={18} className="text-primary" />
              <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">
                Notifications
              </h2>
            </div>
            <PushNotifications mode="organizer" />
          </Card>

          {/* Read-Only Account Metadata Card */}
          <Card className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <h2 className="mb-3 text-sm font-bold tracking-wide uppercase text-muted-foreground">
              Account Overview
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail size={13} /> Email
                </span>
                <span className="font-medium text-foreground truncate max-w-[150px]" title={authEmail || profile.email || ''}>
                  {authEmail || profile.email}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar size={13} /> Created
                </span>
                <span className="font-medium text-foreground">{formatDate(profile.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock size={13} /> Last Sign-In
                </span>
                <span className="font-medium text-foreground">{formatDate(lastSignIn)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Profile Details & Password Forms */}
        <div className="space-y-6 md:col-span-2">
          {/* Personal Details Form */}
          <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 mb-5">
              <User size={20} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">Personal Information</h2>
            </div>

            <form onSubmit={save} className="space-y-5">
              <div>
                <label htmlFor="p-name" className={labelClass}>
                  Full Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="p-name"
                  className="h-11 rounded-xl text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-phone" className={labelClass}>Phone Number</label>
                  <PhoneInput id="p-phone" value={phone} onChange={setPhone} defaultCountryIso="IN" />
                </div>

                <div>
                  <label htmlFor="p-designation" className={labelClass}>Designation / Role</label>
                  <Input
                    id="p-designation"
                    className="h-11 rounded-xl text-sm"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Event Director"
                  />
                </div>
              </div>

              {error && <Alert variant="error">{error}</Alert>}
              {notice && <Alert variant="success">{notice}</Alert>}

              <div className="pt-2">
                <Button
                  type="submit"
                  size="default"
                  className="rounded-full bg-primary font-semibold text-primary-foreground shadow-xs"
                  disabled={saving}
                >
                  {saving ? 'Saving changes...' : 'Save Profile Details'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Security & Password Card */}
          <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2 mb-5">
              <KeyRound size={20} className="text-primary" />
              <h2 className="text-lg font-bold text-foreground">Security & Password</h2>
            </div>
            <ChangePassword email={authEmail} />
          </Card>
        </div>
      </div>
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="pw-current" className={labelClass}>Current Password</label>
        <Input
          id="pw-current"
          type="password"
          className="h-11 rounded-xl text-sm"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
          placeholder="Enter current password"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pw-new" className={labelClass}>New Password</label>
          <Input
            id="pw-new"
            type="password"
            className="h-11 rounded-xl text-sm"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="pw-confirm" className={labelClass}>Confirm New Password</label>
          <Input
            id="pw-confirm"
            type="password"
            className="h-11 rounded-xl text-sm"
            value={confirmNext}
            onChange={(e) => setConfirmNext(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Re-type new password"
          />
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      <div className="pt-2">
        <Button
          type="submit"
          variant="outline"
          className="rounded-full font-semibold shadow-xs"
          disabled={saving || !email}
        >
          {saving ? 'Updating password...' : 'Update Password'}
        </Button>
      </div>
    </form>
  )
}
