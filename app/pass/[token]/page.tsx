import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import LocalTime from '@/components/LocalTime'
import PassAutoRefresh from '@/components/PassAutoRefresh'

// Public web pass: opened from a link on any phone, no login, can be added to the home screen.
// The guest's badge token is the only key. It is an unguessable 32-character value, and the
// page reads only through the existing public_badge function.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Event pass', robots: { index: false, follow: false } }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const longDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9]{32}$/.test(token)) notFound()

  const { data, error } = await supabase.rpc('public_badge', { p_token: token })
  const pass = data?.[0]
  if (error || !pass || pass.status !== 'ok') notFound()

  // The QR holds the badge link, the same value the pickup desk and kiosks already scan
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
  const qr = await QRCode.toDataURL(`${origin}/badge/${token}`, {
    errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark: '#020617', light: '#ffffff' },
  })

  const checkedIn: string | null = pass.checked_in_at
  const place: string = pass.event_location ?? ''

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <article className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-black/50">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-100">Official event pass</p>
          <h1 className="mt-1 text-xl font-bold leading-snug text-white">{pass.event_name}</h1>
        </header>

        <div className="space-y-6 p-6">
          <p
            role="status"
            className={
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ' +
              (checkedIn
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-400')
            }
          >
            {checkedIn ? <>✓ Checked In at <LocalTime iso={checkedIn} /></> : '● Ready for Entry'}
          </p>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Attendee</p>
            <p className="mt-1 text-2xl font-bold leading-tight text-white">{pass.full_name}</p>
            {pass.designation && <p className="mt-1 text-sm text-slate-300">{pass.designation}</p>}
            {pass.company && <p className="text-sm text-slate-400">{pass.company}</p>}
          </div>

          <div className="relative">
            <div className="absolute -left-9 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-950" aria-hidden />
            <div className="absolute -right-9 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-950" aria-hidden />
            <div className="border-t border-dashed border-slate-700" />
          </div>

          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={240} height={240} alt={`Check-in QR code for ${pass.full_name}`} className="h-60 w-60 rounded-xl bg-white p-2" />
            <p className="font-mono text-sm tracking-[0.3em] text-slate-300">{pass.registration_id}</p>
            <p className="text-xs text-slate-500">Show this code at the entrance</p>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-5 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Venue</dt>
              <dd className="mt-1 text-slate-200">{place || 'To be announced'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Date</dt>
              <dd className="mt-1 text-slate-200">{pass.event_date ? longDate(pass.event_date) : 'To be announced'}</dd>
            </div>
          </dl>
        </div>

        <footer className="border-t border-slate-800 bg-slate-950/60 px-6 py-4 text-center text-xs text-slate-500">
          Powered by EventCheckin • Save to Home Screen for quick access
        </footer>
      </article>
      {!checkedIn && <PassAutoRefresh />}
    </main>
  )
}
