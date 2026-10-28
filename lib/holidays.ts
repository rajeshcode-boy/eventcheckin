// Country-wide public holidays from Nager.Date (free, no API key).
// Responses are cached by Next's fetch cache for a day, so guests and organisers
// never trigger a call to the holiday service on each page view.

export interface PublicHoliday {
  date: string // YYYY-MM-DD
  name: string
}

interface NagerHoliday {
  date: string
  localName: string
  name: string
}

const BASE = 'https://date.nager.at/api/v3/PublicHolidays'

// Holidays on or after `fromISO` (YYYY-MM-DD), up to `count` entries, looking ahead across years
export async function upcomingHolidays(country: string, fromISO: string, count = 3): Promise<PublicHoliday[]> {
  const startYear = Number(fromISO.slice(0, 4))
  const found: PublicHoliday[] = []

  for (let year = startYear; year <= startYear + 1 && found.length < count; year++) {
    const res = await fetch(`${BASE}/${year}/${country}`, { next: { revalidate: 86400 } })
    if (!res.ok) break

    const list = (await res.json()) as NagerHoliday[]
    for (const h of list) {
      if (h.date >= fromISO) found.push({ date: h.date, name: h.name })
      if (found.length === count) break
    }
  }

  return found
}
