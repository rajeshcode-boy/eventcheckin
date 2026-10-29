import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

export const LEGAL_UPDATED = '30 October 2026'

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="space-y-3 leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary dark:[&_a]:text-brand [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed">{intro}</p>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
