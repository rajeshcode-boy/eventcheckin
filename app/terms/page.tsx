import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { LegalSection } from '@/components/home/LegalPage'
import { CONTACT_EMAIL } from '@/components/home/content'

export const metadata: Metadata = {
  title: 'Terms of Service | EventCheckin',
  description: 'The terms for using EventCheckin.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms apply when you create an EventCheckin account or use the service. By using EventCheckin, you agree to them."
    >
      <LegalSection title="The service">
        <p>
          EventCheckin helps organisers run events: guest lists, registration links, check-in, kiosks, badges, digital passes,
          dashboards and reports. EventCheckin is currently in beta, which means features may change, improve or occasionally be
          unavailable while we work on them.
        </p>
      </LegalSection>

      <LegalSection title="Price">
        <p>
          EventCheckin is free to use during the beta. If we introduce paid plans, we will tell account holders before any charge
          applies, and nothing will be charged without your agreement.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>Give accurate details when you sign up and keep them up to date.</li>
          <li>Keep your password private. You are responsible for what happens under your account.</li>
          <li>When you add team members to an event, you decide what role and access they have.</li>
          <li>Tell us straight away if you think someone else has used your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Guest information">
        <p>
          When you add guest information, you are responsible for having the right to use it for your event, and for telling your
          guests how their information will be used. You keep ownership of your event and guest data. You allow us to store and
          process it only to provide the service to you. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle it.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use EventCheckin for anything unlawful, or to collect information about people without a lawful reason.</li>
          <li>Upload content that is harmful, misleading or that you do not have the right to use.</li>
          <li>Try to access other organisations&apos; data, get around security or access rules, or disrupt the service.</li>
          <li>Send spam or unwanted messages through registration links or notifications.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          We work to keep EventCheckin running reliably, but we cannot promise it will always be available or free of errors,
          especially during the beta. For important events, keep a recent export of your guest list as a backup.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          EventCheckin is provided as it is during the beta. To the extent the law allows, we are not liable for indirect losses,
          such as lost revenue or a disrupted event, arising from your use of the service. Nothing in these terms limits any rights
          you have that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Ending your use">
        <p>
          You can stop using EventCheckin at any time and ask us to delete your account by emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may close accounts that break these terms.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>If we change these terms, we will update the date at the top of this page and let account holders know about significant changes by email.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
