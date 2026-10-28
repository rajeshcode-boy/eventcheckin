// IANA time zone for an event venue, chosen from the country and city the organiser picks.
// Countries with one time zone map from the country alone. Countries with several time zones
// need the city; an unknown city returns null, so the page shows no zone rather than a wrong one.

const ZONE_BY_COUNTRY: Record<string, string> = {
  IN: 'Asia/Kolkata', AE: 'Asia/Dubai', SA: 'Asia/Riyadh', QA: 'Asia/Qatar', OM: 'Asia/Muscat',
  BH: 'Asia/Bahrain', KW: 'Asia/Kuwait', SG: 'Asia/Singapore', MY: 'Asia/Kuala_Lumpur', TH: 'Asia/Bangkok',
  PH: 'Asia/Manila', VN: 'Asia/Ho_Chi_Minh', HK: 'Asia/Hong_Kong', JP: 'Asia/Tokyo', KR: 'Asia/Seoul',
  CN: 'Asia/Shanghai', TW: 'Asia/Taipei', LK: 'Asia/Colombo', BD: 'Asia/Dhaka', NP: 'Asia/Kathmandu',
  PK: 'Asia/Karachi', NZ: 'Pacific/Auckland', GB: 'Europe/London', IE: 'Europe/Dublin', FR: 'Europe/Paris',
  DE: 'Europe/Berlin', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', ES: 'Europe/Madrid', PT: 'Europe/Lisbon',
  IT: 'Europe/Rome', CH: 'Europe/Zurich', AT: 'Europe/Vienna', SE: 'Europe/Stockholm', NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki', PL: 'Europe/Warsaw', CZ: 'Europe/Prague', GR: 'Europe/Athens',
  TR: 'Europe/Istanbul', IL: 'Asia/Jerusalem', EG: 'Africa/Cairo', MA: 'Africa/Casablanca', ZA: 'Africa/Johannesburg',
  KE: 'Africa/Nairobi', NG: 'Africa/Lagos', AR: 'America/Argentina/Buenos_Aires', CL: 'America/Santiago',
  CO: 'America/Bogota',
}

// Countries with several zones: the zone depends on the city
const ZONE_BY_CITY: Record<string, Record<string, string>> = {
  US: {
    'New York': 'America/New_York', Boston: 'America/New_York', Miami: 'America/New_York',
    Chicago: 'America/Chicago', Austin: 'America/Chicago',
    'Los Angeles': 'America/Los_Angeles', 'San Francisco': 'America/Los_Angeles', Seattle: 'America/Los_Angeles',
    'Las Vegas': 'America/Los_Angeles',
  },
  CA: {
    Toronto: 'America/Toronto', Montreal: 'America/Toronto', Ottawa: 'America/Toronto',
    Calgary: 'America/Edmonton', Vancouver: 'America/Vancouver',
  },
  MX: { 'Mexico City': 'America/Mexico_City', Guadalajara: 'America/Mexico_City', Monterrey: 'America/Monterrey', 'Cancún': 'America/Cancun' },
  BR: { 'São Paulo': 'America/Sao_Paulo', 'Rio de Janeiro': 'America/Sao_Paulo', 'Brasília': 'America/Sao_Paulo' },
  AU: {
    Sydney: 'Australia/Sydney', Canberra: 'Australia/Sydney', Melbourne: 'Australia/Melbourne',
    Brisbane: 'Australia/Brisbane', 'Gold Coast': 'Australia/Brisbane',
    Perth: 'Australia/Perth', Adelaide: 'Australia/Adelaide',
  },
  ID: { Bali: 'Asia/Makassar', Jakarta: 'Asia/Jakarta', Surabaya: 'Asia/Jakarta', Bandung: 'Asia/Jakarta', Yogyakarta: 'Asia/Jakarta' },
}

export function timezoneFor(country: string | null | undefined, city: string | null | undefined): string | null {
  if (!country) return null
  const byCity = city ? ZONE_BY_CITY[country]?.[city] : undefined
  if (byCity) return byCity
  if (ZONE_BY_CITY[country]) return null
  return ZONE_BY_COUNTRY[country] ?? null
}

// Offset label such as "UTC+3" for the given date in that zone ("UTC" when there is no offset)
export function zoneShortName(zone: string, isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  const label = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value ?? zone
  return label.replace(/^GMT/, 'UTC')
}
