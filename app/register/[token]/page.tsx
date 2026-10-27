'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Info {
  name: string
  location: string
  event_date: string
  registration_open: boolean
  is_full: boolean
  approval_mode: string
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

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-neutral-light)', padding: '40px 16px' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <p style={{ fontWeight: 700, fontSize: '17px', marginBottom: '20px' }}>EventCheckin</p>
        {children}
      </div>
    </div>
  )

  if (loading) return shell(<p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>)

  if (error || !info) return shell(<div className="card" style={{ padding: '24px' }}><p>{error || 'This registration link is not valid.'}</p></div>)

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
      <div className="card" style={{ padding: '24px' }} role="status">
        <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{m.title}</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{m.body}</p>
        {result.registration_id && !pending && (
          <p style={{ marginTop: '16px', fontSize: '14px' }}>
            Your registration ID: <code style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{result.registration_id}</code>
          </p>
        )}
      </div>
    )
  }

  if (!info.registration_open || info.is_full) {
    return shell(
      <div className="card" style={{ padding: '24px' }}>
        <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{info.name}</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {info.is_full ? 'All places are taken.' : 'Registration is not open right now.'}
        </p>
      </div>
    )
  }

  const field = (label: string, key: keyof typeof form, opts: { type?: string; required?: boolean; help?: string } = {}) => (
    <div>
      <label htmlFor={key} style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}>
        {label}{opts.required ? ' *' : ''}
      </label>
      <input
        id={key}
        type={opts.type ?? 'text'}
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value)}
        className="input-field"
      />
      {opts.help && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{opts.help}</p>}
    </div>
  )

  return shell(
    <div className="card" style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>{info.name}</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
        {info.location} · {date}
      </p>

      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {field('First name', 'first_name', { required: true })}
          {field('Last name', 'last_name')}
        </div>
        {field('Designation', 'designation', { required: true })}
        {field('Company', 'company', { required: true })}
        {field('Email', 'email', { type: 'email', required: true })}
        {field('Phone', 'phone', { type: 'tel', help: 'Optional. Include the country code, for example +91 98765 43210.' })}

        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '14px' }}>
          <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} style={{ marginTop: '3px' }} />
          <span>I agree that my details are used to manage this event and for check-in and badge printing.</span>
        </label>

        {fieldError && <div className="alert-error" role="alert">{fieldError}</div>}

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  )
}
