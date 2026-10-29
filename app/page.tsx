import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Check, ChevronDown, MonitorSmartphone, Sparkles, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SiteHeader from '@/components/home/SiteHeader'
import SiteFooter from '@/components/home/SiteFooter'
import HeroVisual from '@/components/home/HeroVisual'
import CheckinDemo from '@/components/home/CheckinDemo'
import SignedInRedirect from '@/components/home/SignedInRedirect'
import { BETA_INCLUDES, BOOKING_URL, COMING_SOON, FAQS, FEATURES, STEPS } from '@/components/home/content'

export const metadata: Metadata = {
  title: 'EventCheckin | Event registration and QR check-in',
  description:
    'Import your guest list, check guests in with a QR scan, print badges and watch attendance live. Free while in beta.',
}

const FACTS = [
  { icon: MonitorSmartphone, title: 'Nothing to install', body: 'Runs in the browser on any phone, tablet or laptop' },
  { icon: WifiOff, title: 'Kiosks work offline', body: 'Check-ins upload when the Wi-Fi comes back' },
  { icon: Sparkles, title: 'Free during beta', body: 'Every feature, no card needed' },
]

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary dark:text-brand">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-muted-foreground">{sub}</p>}
    </div>
  )
}

const bookingProps = { href: BOOKING_URL, target: '_blank', rel: 'noopener noreferrer' }

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SignedInRedirect />
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-0 size-[560px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-2 lg:gap-10 lg:pb-28">
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary dark:text-brand">
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                Registration and check-in for events
              </p>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Welcome every guest with <span className="text-primary dark:text-brand">hassle-free</span> check-in
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
                Import your guest list, check people in with a QR scan, hand out badges and see who has arrived as it happens. Built for
                conferences, summits and corporate events.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button size="lg" className="h-12 px-6 text-base" render={<Link href="/signup" />} nativeButton={false}>
                  Start for free <ArrowRight />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" render={<a {...bookingProps} />} nativeButton={false}>
                  <CalendarDays /> Book a demo
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Free while in beta. No card needed.</p>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section aria-label="Highlights" className="border-y border-border bg-card">
          <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-3">
            {FACTS.map((f) => (
              <div key={f.title} className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground dark:text-brand">
                  <f.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-16 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead
              eyebrow="Everything you need"
              title="Built for the busy registration desk"
              sub="From the first registration to the final headcount, your guest list, check-in and badges live in one place."
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-card p-6 transition-transform hover:-translate-y-0.5">
                  <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground dark:text-brand">
                    <f.icon className="size-6" />
                  </span>
                  <h3 className="mb-2 font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/60 p-6 sm:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground dark:text-brand">Coming soon</span>
                <p className="text-sm text-muted-foreground">On our roadmap and not available yet.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {COMING_SOON.map((c) => (
                  <div key={c.title}>
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 border-t border-border bg-card py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow="Three steps" title="How EventCheckin works" sub="Set up your event in an afternoon and run the door on the day." />
            <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-border bg-background p-7 text-center">
                  <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{i + 1}</span>
                  <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                  <p className="mt-5 border-t border-border pt-4 text-xs font-semibold text-primary dark:text-brand">{s.tag}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="demo" className="scroll-mt-16 border-t border-border py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead
              eyebrow="Try it here"
              title="See the check-in desk in action"
              sub="Check guests in, or press Simulate QR scan to see each guest's pass update and the headcount move."
            />
            <CheckinDemo />
          </div>
        </section>

        <section id="pricing" className="scroll-mt-16 border-t border-border bg-card py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow="Pricing" title="Free while we are in beta" sub="Use every feature for your events at no cost while EventCheckin is in beta." />
            <div className="mx-auto grid grid-cols-1 max-w-4xl gap-6 md:grid-cols-[3fr_2fr]">
              <div className="relative rounded-3xl border-2 border-primary bg-background p-8 shadow-lg">
                <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">Beta</span>
                <h3 className="text-xl font-bold">Everything included</h3>
                <p className="mt-1 text-sm text-muted-foreground">For organisers running events of any size</p>
                <p className="my-6">
                  <span className="text-5xl font-extrabold">Free</span>
                  <span className="ml-2 text-sm text-muted-foreground">during beta</span>
                </p>
                <ul className="space-y-3 text-sm">
                  {BETA_INCLUDES.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary dark:text-brand" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button size="lg" className="mt-8 h-12 w-full text-base" render={<Link href="/signup" />} nativeButton={false}>
                  Create your free account
                </Button>
              </div>

              <div className="flex flex-col rounded-3xl border border-border bg-background p-8">
                <h3 className="text-xl font-bold">Large or complex event?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Running a multi-day summit, several entrances or thousands of guests? Book a call and we will help you plan the setup.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {['Help planning your check-in setup', 'Guidance on importing your guest list', 'A walkthrough for your team'].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary dark:text-brand" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button size="lg" variant="outline" className="mt-auto h-12 w-full text-base max-md:mt-8" render={<a {...bookingProps} />} nativeButton={false}>
                  <CalendarDays /> Book a call
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-16 border-t border-border py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <SectionHead eyebrow="Questions" title="Frequently asked questions" />
            <div className="space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-border bg-card px-6 py-5 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="size-5 shrink-0 text-primary dark:text-brand transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Still have a question?{' '}
              <a {...bookingProps} className="font-semibold text-primary dark:text-brand underline-offset-4 hover:underline">
                Book a call with us
              </a>
              .
            </p>
          </div>
        </section>

        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Your next event deserves a better first impression</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg opacity-85">Create a free account and check in your first guests today.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-neutral-50 px-6 text-base text-neutral-900 hover:bg-neutral-200"
                render={<Link href="/signup" />}
                nativeButton={false}
              >
                Start for free <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-neutral-50/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-neutral-50/10 hover:text-primary-foreground"
                render={<a {...bookingProps} />}
                nativeButton={false}
              >
                Talk to us
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
