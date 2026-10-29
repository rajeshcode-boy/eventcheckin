'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { publicImageUrl } from '@/lib/images'
import { countryName } from '@/lib/countries'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Info {
  name: string
  location: string
  city: string | null
  country: string | null
  event_date: string
  registration_open: boolean
  is_full: boolean
  approval_mode: string
  banner_path: string | null
  logo_path: string | null
  org_logo_path: string | null
}

type Result = { status: string; registration_id: string | null } | null

// Public self-registration page. Shared links can carry ?ref=CODE (team member) and ?src=channel.
export default function RegisterPage() {
  const params = useParams()
  const token = params.token as string

  const [info, setInfo] = useState<Info | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ref, setRef] = useState('')
  const [src, setSrc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', designation: '', company: '', email: '', phone: '', consent: false })
  const [fieldError, setFieldError] = useState('')

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setRef(q.get('ref') ?? '')
    setSrc(q.get('src') ?? '')
    supabase.rpc('public_registration_info', { p_token: token }).then(({ data, error: rpcError }) => {
      if (rpcError) setError("Couldn't load this registration page. Try again later.")
      else if (!data || data.length === 0) setError('This registration link is not valid.')
      else setInfo(data[0] as Info)
      setLoading(false)
    })
  }, [token])

  const set = (key: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.designation.trim() || !form.company.trim()) {
      setFieldError('Enter your name, designation and company.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFieldError('Enter a valid email address.')
      return
    }
    if (!form.consent) {
      setFieldError('Tick the box to agree to your details being used for this event.')
      return
    }
    setSubmitting(true)
    const { data, error: rpcError } = await supabase.rpc('public_register_online', {
      p_token: token,
      p_first_name: form.first_name,
      p_last_name: form.last_name,
      p_designation: form.designation,
      p_company: form.company,
      p_email: form.email,
      p_phone: form.phone,
      p_ref: ref,
      p_src: src,
      p_consent: form.consent,
    })
    setSubmitting(false)
    if (rpcError || !data || data.length === 0) {
      setFieldError("Couldn't complete your registration. Try again in a moment.")
      return
    }
    setResult(data[0] as Result)
  }

  // Event branding above the form; the small label stays for the organiser's brand
  const bannerUrl = info ? publicImageUrl('branding', info.banner_path) : null
  const logoUrl = info ? publicImageUrl('branding', info.logo_path ?? info.org_logo_path) : null

  const panel = 'rounded-xl border border-border bg-card p-6'

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background px-4 pt-8 pb-12">
      <div className="mx-auto max-w-[520px]">
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="mb-4 aspect-[4/1] w-full rounded-xl border border-border object-cover" />
        )}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[15px] font-bold text-muted-foreground">EventCheckin</p>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 max-w-[140px] object-contain" />
          )}
        </div>
        {children}
      </div>
    </div>
  )

  if (loading) return shell(<p className="text-muted-foreground">Loading...</p>)

  if (error || !info) return shell(<div className={panel}><p>{error || 'This registration link is not valid.'}</p></div>)

  const date = new Date(info.event_date + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })

  if (result) {
    const pending = result.status === 'pending'
    const messages: Record<string, { title: string; body: string }> = {
      registered: { title: "You're registered", body: `Your registration for ${info.name} is confirmed. Keep this page or the confirmation email for entry.` },
      pending: { title: 'Registration received', body: 'The organiser will review your registration and confirm it by email.' },
      already_registered: { title: 'You are already registered', body: 'This email already has a registration for this event.' },
      full: { title: 'This event is full', body: 'Registration has closed because all places are taken.' },
      closed: { title: 'Registration is closed', body: 'The organiser has closed registration for this event.' },
      invalid: { title: "Some details aren't valid", body: 'Check your details and try again.' },
    }
    const m = messages[result.status] ?? messages.invalid!
    return shell(
      <div className={panel} role="status">
        <p className="mb-2 text-lg font-semibold">{m.title}</p>
        <p className="text-sm text-muted-foreground">{m.body}</p>
        {result.registration_id && !pending && (
          <p className="mt-4 text-sm">
            Your registration ID: <code className="font-mono font-semibold">{result.registration_id}</code>
          </p>
        )}
      </div>
    )
  }

  if (!info.registration_open || info.is_full) {
    return shell(
      <div className={panel}>
        <p className="mb-2 text-lg font-semibold">{info.name}</p>
        <p className="text-sm text-muted-foreground">
          {info.is_full
            ? 'All places for this event are taken. Contact the organiser to join the waiting list.'
            : 'Registration is not open yet. Check back later or contact the organiser.'}
        </p>
      </div>
    )
  }

  const field = (label: string, key: keyof typeof form, opts: { type?: string; required?: boolean; help?: string } = {}) => (
    <div>
      <label htmlFor={key} className="mb-1.5 block text-sm font-medium">
        {label}{opts.required ? ' *' : ''}
      </label>
      <Input
        id={key}
        type={opts.type ?? 'text'}
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value)}
        className="h-11 text-base"
      />
      {opts.help && <p className="mt-1 text-[13px] text-muted-foreground">{opts.help}</p>}
    </div>
  )

  return shell(
    <div className={panel}>
      <h1 className="mb-1.5 text-[22px] font-bold tracking-tight">{info.name}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {info.city && info.country ? `${info.city}, ${countryName(info.country)}` : info.location} · {date}
      </p>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {field('First name', 'first_name', { required: true })}
          {field('Last name', 'last_name')}
        </div>
        {field('Designation', 'designation', { required: true })}
        {field('Company', 'company', { required: true })}
        {field('Email', 'email', { type: 'email', required: true })}
        {field('Phone', 'phone', { type: 'tel', help: 'Optional. Include the country code, for example +91 98765 43210.' })}

        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-[3px] accent-primary" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
          <span>I agree that my details are used to manage this event and for check-in and badge printing.</span>
        </label>

        {fieldError && <Alert variant="error">{fieldError}</Alert>}

        <Button type="submit" size="lg" className="h-11 text-base" disabled={submitting}>
          {submitting ? 'Registering...' : 'Register'}
        </Button>
      </form>
    </div>
  )
}
