import type { Metadata } from 'next'
import LegalPage, { LegalSection } from '@/components/home/LegalPage'
import { CONTACT_EMAIL } from '@/components/home/content'

export const metadata: Metadata = {
  title: 'Privacy Policy | EventCheckin',
  description: 'What information EventCheckin collects, how it is used and the choices you have.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what information EventCheckin collects, why, who it is shared with, and the choices you have. It covers event organisers who use EventCheckin and the guests whose details organisers manage in it."
    >
      <LegalSection title="Who we are">
        <p>
          EventCheckin is a web app that event organisers use to manage guest lists, registration, check-in and badges. You can
          contact us about privacy at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          For guest information, the event organiser decides what is collected and how it is used. EventCheckin stores and
          processes that information on the organiser&apos;s behalf. If you are a guest, the organiser of your event is your
          first point of contact, and you can also write to us.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p><strong>Organiser accounts.</strong> Your name, email address, organisation name, password (stored only in encrypted, hashed form) and, if you add one, a profile photo.</p>
        <p>
          <strong>Guest information.</strong> Details organisers import or guests enter when they register or check in, such as
          name, email, phone number, company, job title, country, city and industry.
        </p>
        <p><strong>Event activity.</strong> Check-in times and methods, badge printing and pickup records, and which team member made a change.</p>
        <p><strong>Event content.</strong> Event details, logos and banners that organisers upload.</p>
        <p>
          <strong>Notifications.</strong> If you turn on push notifications, your browser gives us a subscription address so we can
          send them to that device.
        </p>
        <p>
          <strong>Usage data.</strong> We use Vercel Web Analytics to count page visits. It does not use cookies and does not
          identify individual visitors.
        </p>
        <p>
          <strong>Product analytics, only if you accept.</strong> If you accept cookies in the banner, we use PostHog to see which
          pages and buttons are used and to replay how a page was used, so we can improve EventCheckin. Text on the page and
          anything you type are hidden before anything is sent, so names, emails and guest details are never recorded. Signed-in
          organisers are linked to an internal account ID only, never a name or email. Guest pages (registration, check-in,
          passes, badges and kiosks) are never tracked. You can change your choice at any time with Cookie settings at the
          bottom of the home page.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul>
          <li>To run the service: sign-in, guest lists, registration, check-in, badges, passes and reports.</li>
          <li>To show organisers live attendance and send the notifications they ask for.</li>
          <li>To keep the service secure and fix problems.</li>
          <li>To reply when you contact us.</li>
        </ul>
        <p>We do not sell personal information, and we do not use guest information for advertising.</p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>We use a small number of service providers to run EventCheckin:</p>
        <ul>
          <li><strong>Supabase</strong> hosts our database, sign-in and file storage.</li>
          <li><strong>Vercel</strong> hosts the website and provides privacy-friendly visit counts.</li>
          <li><strong>PostHog</strong> provides product analytics, only for visitors who accept cookies.</li>
          <li><strong>Browser push services</strong> from Apple, Google and Mozilla deliver notifications you have turned on.</li>
        </ul>
        <p>
          Within an event, information is visible to the organiser&apos;s team according to their role. A guest&apos;s own digital pass
          can be opened by anyone who has its private link, so guests should share that link with care. We may disclose
          information if the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="Information stored on your device">
        <p>
          EventCheckin keeps your sign-in session, your light or dark theme choice and your cookie choice in your
          browser&apos;s storage. If you accept cookies, PostHog also stores a cookie with a random visitor ID. A paired
          check-in kiosk keeps that event&apos;s guest list and any check-ins it has not uploaded yet on the tablet, so it can work
          offline. Unpairing the kiosk clears this.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          All traffic is encrypted over HTTPS. Database access rules make sure each organisation can only see its own events and
          guests, and team members only see what their role allows. No system is perfectly secure, so please use a strong password
          and keep it private.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep information">
        <p>
          We keep event and guest information until the organiser deletes it or closes their account. To have your account or
          your information deleted, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          You can ask to see, correct or delete the personal information we hold about you by emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Guests can also ask the event organiser directly. You can turn
          off push notifications at any time in your browser settings.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>EventCheckin is meant for event organisers and their guests, and is not directed at children under 16.</p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>If we change this policy, we will update the date at the top of this page. For significant changes, we will also let account holders know by email.</p>
      </LegalSection>
    </LegalPage>
  )
}
