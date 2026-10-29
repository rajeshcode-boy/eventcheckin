// Country-wide public holidays. Nager.Date (free, no API key, community-maintained) is used
// where it has data; a hand-maintained list covers the rest. Responses are cached by Next's
// fetch cache for a day, so the holiday service is not called on each page view.
import { CURATED_HOLIDAYS } from './holidays-curated'

export interface PublicHoliday {
  date: string // YYYY-MM-DD
  name: string
}

export interface HolidayResult {
  holidays: PublicHoliday[]
  // false when no source has holiday data for this country, so the page can say so
  // rather than showing an empty list that looks like "no holidays"
  covered: boolean
  // Set when the hand-maintained list has run out of years, so organisers see it needs updating
  listNeedsUpdate?: boolean
}

interface NagerHoliday {
  date: string
  name: string
  global: boolean // false for regional holidays such as a state festival
}

const BASE = 'https://date.nager.at/api/v3/PublicHolidays'

// Holidays on or after `fromISO` (YYYY-MM-DD), up to `count` entries, looking ahead across years
export async function upcomingHolidays(country: string, fromISO: string, count = 3): Promise<HolidayResult> {
  // Countries the API does not cover use the hand-maintained list
  const curated = CURATED_HOLIDAYS[country]
  if (curated) {
    const holidays = curated
      .filter((h) => h.date >= fromISO)
      .slice(0, count)
      .map((h) => ({ date: h.date, name: h.tentative ? `${h.name} (tentative)` : h.name }))
    // Nothing left in the list means it needs new dates
    return { holidays, covered: true, listNeedsUpdate: holidays.length === 0 }
  }

  const startYear = Number(fromISO.slice(0, 4))
  const found: PublicHoliday[] = []

  for (let year = startYear; year <= startYear + 1 && found.length < count; year++) {
    const res = await fetch(`${BASE}/${year}/${country}`, { next: { revalidate: 86400 } })
    // 204 means the service has no data for this country and year
    if (!res.ok || res.status === 204) continue

    const list = (await res.json()) as NagerHoliday[]
    for (const h of list) {
      // Only national holidays: regional ones would be wrong for a venue in another region
      if (h.global && h.date >= fromISO) found.push({ date: h.date, name: h.name })
      if (found.length === count) break
    }
  }

  return { holidays: found, covered: found.length > 0 }
}
