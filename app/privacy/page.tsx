import Link from 'next/link'

// Placeholder page so the signup checkbox links somewhere real.
// Replace this copy with your actual Privacy Policy before relying on it legally.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-12 text-foreground">
      <h1 className="mb-4 text-2xl font-bold">Privacy Policy</h1>
      <p className="mb-3 leading-relaxed text-muted-foreground">
        This is placeholder text. Replace this page with your organization&apos;s actual privacy
        policy before relying on it for real sign-ups.
      </p>
      <p className="leading-relaxed text-muted-foreground">
        EventCheckin stores the event, guest, and account details needed to run check-in and
        registration for your events, and does not sell attendee data to third parties.
      </p>
      <Link href="/signup" className="mt-6 inline-block font-semibold text-primary">
        ← Back to sign up
      </Link>
    </div>
  )
}
