'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Building2, UserCheck } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 8
const fieldLabel = 'mb-1.5 block text-sm font-medium'

// 0-4: how many of these the password meets (length, lowercase+uppercase, a digit, a symbol)
function passwordScore(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  return score
}

const STRENGTH = [
  { label: 'Weak', text: 'text-destructive', bar: 'bg-destructive' },
  { label: 'Weak', text: 'text-destructive', bar: 'bg-destructive' },
  { label: 'Fair', text: 'text-amber-600', bar: 'bg-amber-500' },
  { label: 'Good', text: 'text-primary', bar: 'bg-primary' },
  { label: 'Strong', text: 'text-(--color-live)', bar: 'bg-(--color-live)' },
] as const

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const invitedOrgId = searchParams.get('org') || ''
  const invitedRole = searchParams.get('role') || 'staff'
  const invitedEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(invitedEmail)
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [invitedOrgName, setInvitedOrgName] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail)
  }, [invitedEmail])

  useEffect(() => {
    if (!invitedOrgId) return
    const fetchOrg = async () => {
      const { data } = await supabase.from('organizations').select('name').eq('id', invitedOrgId).single()
      if (data?.name) {
        setInvitedOrgName(data.name)
      }
    }
    fetchOrg()
  }, [invitedOrgId])

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH
  const strength = STRENGTH[passwordScore(password)] ?? STRENGTH[0]

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!agreedToTerms) {
      setError('Agree to the Terms and Conditions and Privacy Policy to continue.')
      return
    }

    setLoading(true)

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`
      const metaData: Record<string, string> = { full_name: fullName }

      if (invitedOrgId) {
        metaData.invited_org_id = invitedOrgId
        metaData.invited_role = invitedRole === 'admin' ? 'admin' : 'staff'
      } else {
        metaData.org_name = orgName
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metaData,
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
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-[420px]">
        {/* Brand: same mark as the app header and login page */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">✓</span>
          <span className="text-lg font-bold tracking-tight">EventCheckin</span>
        </div>

        <div className="rounded-2xl border border-border bg-card px-6 py-7 shadow-xs">
          <h1 className="mb-2 text-center text-[22px] font-bold tracking-tight">
            {invitedOrgId ? 'Join Team' : 'Sign up'}
          </h1>

          {invitedOrgId && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                You are joining <strong>{invitedOrgName || 'the organization'}</strong> as <strong>{invitedRole === 'admin' ? 'Organization Admin' : 'Staff Member'}</strong>.
              </span>
            </div>
          )}

          {!invitedOrgId && (
            <p className="mb-5 text-center text-xs text-muted-foreground">
              Create an organization account to start hosting events.
            </p>
          )}

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {!invitedOrgId && (
              <div>
                <label htmlFor="orgName" className={fieldLabel}>
                  Organization name <span aria-hidden="true" className="text-destructive">*</span>
                </label>
                <Input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="h-11 text-base rounded-xl"
                  placeholder="My organization"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className={fieldLabel}>
                  First name <span aria-hidden="true" className="text-destructive">*</span>
                </label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 text-base rounded-xl"
                  placeholder="First"
                  autoComplete="given-name"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className={fieldLabel}>
                  Last name <span aria-hidden="true" className="text-destructive">*</span>
                </label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 text-base rounded-xl"
                  placeholder="Last"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={fieldLabel}>
                Email <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-base rounded-xl"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className={fieldLabel}>
                Password <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11 text-base rounded-xl"
                  placeholder="Enter a password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-2.5 flex -translate-y-1/2 rounded-md bg-transparent p-1 text-muted-foreground"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              {password && (
                <div className="mt-2.5">
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Password strength:</span>
                    <span className={cn('font-semibold', strength.text)}>{strength.label}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-border">
                    <div className={cn('h-full transition-[width,background-color] duration-150', strength.bar)} style={{ width: `${(passwordScore(password) / 4) * 100}%` }} />
                  </div>
                </div>
              )}

              <p className={cn('mt-2.5 flex items-center gap-1.5 text-[13px]', passwordLongEnough ? 'text-(--color-live)' : 'text-muted-foreground')}>
                <span aria-hidden="true">{passwordLongEnough ? '✓' : '•'}</span>
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-[3px] accent-primary"
                required
              />
              <span>
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="font-semibold text-primary">
                  Terms and Conditions
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="font-semibold text-primary">
                  Privacy Policy
                </Link>
              </span>
            </label>

            {error && <Alert variant="error">{error}</Alert>}

            <Button type="submit" size="lg" className="mt-1 h-11 w-full text-base rounded-xl font-semibold" disabled={loading}>
              {loading ? 'Creating account...' : invitedOrgId ? 'Join Organization' : 'Sign up'}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading signup...</div>}>
      <SignupForm />
    </Suspense>
  )
}
