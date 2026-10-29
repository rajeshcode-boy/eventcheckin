import Link from 'next/link'

// Placeholder page so the signup checkbox links somewhere real.
// Replace this copy with your actual Terms of Service before relying on it legally.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[640px] px-5 py-12 text-foreground">
      <h1 className="mb-4 text-2xl font-bold">Terms and Conditions</h1>
      <p className="mb-3 leading-relaxed text-muted-foreground">
        This is placeholder text. Replace this page with your organization&apos;s actual terms of
        service before relying on it for real sign-ups.
      </p>
      <p className="leading-relaxed text-muted-foreground">
        By using EventCheckin you agree to use the service responsibly and to keep your account
        credentials confidential.
      </p>
      <Link href="/signup" className="mt-6 inline-block font-semibold text-primary">
        ← Back to sign up
      </Link>
    </div>
  )
}
