'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const MIN_PASSWORD_LENGTH = 6

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Sign up user; the handle_new_user DB trigger creates the
      // organization and admin profile from this metadata
      const fullName = `${firstName.trim()} ${lastName.trim()}`

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, org_name: orgName },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (!authData.user) {
        setError('Sign up failed')
        return
      }

      // Signed in already when email confirmation is off
      if (authData.session) {
        router.push('/events')
        return
      }

      // Redirect to login
      router.push('/login?message=Check your email to confirm your account')
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldLabel = { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 } as const

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backgroundColor: 'var(--color-neutral-light)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Brand: same mark as the app header and login page */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px', textAlign: 'center' }}>
          <span aria-hidden="true" style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--color-primary)', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700 }}>✓</span>
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>EventCheckin</span>
        </div>

        <div className="card" style={{ padding: '28px 24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center', marginBottom: '20px' }}>
            Sign up
          </h1>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="orgName" style={fieldLabel}>
                Organization name <span aria-hidden="true" style={{ color: 'var(--color-error-red)' }}>*</span>
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input-field"
                placeholder="My organization"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <div>
                <label htmlFor="firstName" style={fieldLabel}>
                  First name <span aria-hidden="true" style={{ color: 'var(--color-error-red)' }}>*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input-field"
                  placeholder="First"
                  autoComplete="given-name"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" style={fieldLabel}>
                  Last name <span aria-hidden="true" style={{ color: 'var(--color-error-red)' }}>*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input-field"
                  placeholder="Last"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" style={fieldLabel}>
                Email <span aria-hidden="true" style={{ color: 'var(--color-error-red)' }}>*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" style={fieldLabel}>
                Password <span aria-hidden="true" style={{ color: 'var(--color-error-red)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter a password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  style={{ paddingRight: '64px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '6px 10px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', backgroundColor: 'transparent', borderRadius: '6px' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p style={{ marginTop: '8px', fontSize: '13px', color: passwordLongEnough ? 'var(--color-live)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span aria-hidden="true">{passwordLongEnough ? '✓' : '•'}</span>
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            </div>

            {error && (
              <div role="alert" className="alert-error" style={{ borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginTop: '4px' }}
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
