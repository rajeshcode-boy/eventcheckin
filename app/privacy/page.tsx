import Link from 'next/link'

// Placeholder page so the signup checkbox links somewhere real.
// Replace this copy with your actual Privacy Policy before relying on it legally.
export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 20px', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
        This is placeholder text. Replace this page with your organization&apos;s actual privacy
        policy before relying on it for real sign-ups.
      </p>
      <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        EventCheckin stores the event, guest, and account details needed to run check-in and
        registration for your events, and does not sell attendee data to third parties.
      </p>
      <Link href="/signup" style={{ display: 'inline-block', marginTop: '24px', color: 'var(--color-primary)', fontWeight: 600 }}>
        ← Back to sign up
      </Link>
    </div>
  )
}
