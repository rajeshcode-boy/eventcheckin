import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Well-known city codes; other locations fall back to their first 3 letters
const CITY_CODES: Record<string, string> = {
  BENGALURU: 'BLR',
  BANGALORE: 'BLR',
  MUMBAI: 'BOM',
  BOMBAY: 'BOM',
  DELHI: 'DEL',
  NEWDELHI: 'DEL',
  CHENNAI: 'MAA',
  MADRAS: 'MAA',
  KOLKATA: 'CCU',
  CALCUTTA: 'CCU',
  HYDERABAD: 'HYD',
  PUNE: 'PNQ',
  AHMEDABAD: 'AMD',
  KOCHI: 'COK',
  COCHIN: 'COK',
  GOA: 'GOI',
  JAIPUR: 'JAI',
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// Generate event ID: NAME-LOCATION-DDMONYYYY
// Date is read in UTC because date inputs ('2026-11-15') parse as UTC midnight.
export function generateEventId(
  name: string,
  location: string,
  date: Date
): string {
  const cleanName =
    name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20) || 'EVENT'

  const letters = location.toUpperCase().replace(/[^A-Z]/g, '')
  const cleanLocation = CITY_CODES[letters] || letters.substring(0, 3) || 'LOC'

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = MONTHS[date.getUTCMonth()]

  return `${cleanName}-${cleanLocation}-${day}${month}${date.getUTCFullYear()}`
}

// Generate registration ID: 6-char alphanumeric
export function generateRegistrationId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

// Validate email format
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

// Normalize email and phone for matching
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function normalizePhone(phone: string): string {
  return phone.trim()
}
