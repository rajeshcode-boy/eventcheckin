import { NextRequest, NextResponse } from 'next/server'
import { upcomingHolidays } from '@/lib/holidays'

// Upcoming public holidays for a country, e.g. /api/holidays?country=IN&from=2026-10-28
// Public, read-only data. `country` must be an ISO 3166-1 alpha-2 code.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const country = (params.get('country') ?? '').toUpperCase()
  const from = params.get('from') ?? new Date().toISOString().slice(0, 10)

  if (!/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: 'Invalid country' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

  try {
    const holidays = await upcomingHolidays(country, from, 3)
    return NextResponse.json({ holidays })
  } catch {
    // Holidays are extra information, so a failure should not break the page
    return NextResponse.json({ holidays: [] })
  }
}
