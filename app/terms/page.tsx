import Link from 'next/link'

// Placeholder page so the signup checkbox links somewhere real.
// Replace this copy with your actual Terms of Service before relying on it legally.
export default function TermsPage() {
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 20px', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>Terms and Conditions</h1>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
        This is placeholder text. Replace this page with your organization&apos;s actual terms of
        service before relying on it for real sign-ups.
      </p>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        By using EventCheckin you agree to use the service responsibly and to keep your account
        credentials confidential.
      </p>
      <Link href="/signup" style={{ display: 'inline-block', marginTop: '24px', color: 'var(--color-primary)', fontWeight: 600 }}>
        ← Back to sign up
      </Link>
    </div>
  )
}
