'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const router = useRouter()

  // Shown after logging out from the profile menu
  useEffect(() => {
    setSignedOut(new URLSearchParams(window.location.search).get('signedout') === '1')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      if (data.user) {
        router.push('/events')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
      <div className="w-full max-w-[400px]">
        {/* Brand: same mark as the app header */}
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">✓</span>
          <div>
            <h1 className="text-2xl leading-tight font-bold tracking-[-0.02em]">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Log in to manage your EventCheckin events.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          {signedOut && (
            <div role="status" className="mb-5 rounded-lg bg-accent px-3.5 py-3 text-sm font-medium text-primary">
              You&apos;ve signed out.
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-base"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11 text-base"
                  placeholder="Enter your password"
                  autoComplete="current-password"
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
            </div>

            {error && <Alert variant="error">{error}</Alert>}

            <Button type="submit" size="lg" className="mt-1 h-11 w-full text-base" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Don&apos;t have an account?</p>
          <Button variant="outline" size="lg" className="h-11 w-full text-base" render={<Link href="/signup" />} nativeButton={false}>
            Create an account
          </Button>
        </div>
      </div>
    </div>
  )
}
