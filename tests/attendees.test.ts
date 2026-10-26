import {
  autoMapColumns, findDuplicates, guestsToCsvRows, normalizeAttendanceConfirmation, normalizeAttendeeFields,
  normalizeIndustry, normalizeRegistrationStatus, planImport, rowsToGuests, toCsv, type Guest,
} from '../lib/guests'
import { countryIsoFromInput, countryName, detectCountry } from '../lib/countries'
import { citiesFor } from '../lib/cities'

describe('attendee field normalisation', () => {
  test('registration status accepts labels and common spellings', () => {
    expect(normalizeRegistrationStatus('Approved')).toBe('approved')
    expect(normalizeRegistrationStatus('canceled')).toBe('cancelled')
    expect(normalizeRegistrationStatus('PENDING')).toBe('pending')
    expect(normalizeRegistrationStatus('unknown')).toBeUndefined()
  })

  test('attendance confirmation maps yes/no/tentative', () => {
    expect(normalizeAttendanceConfirmation('Yes')).toBe('confirmed')
    expect(normalizeAttendanceConfirmation('not confirmed')).toBe('not_confirmed')
    expect(normalizeAttendanceConfirmation('Tentative')).toBe('maybe')
    expect(normalizeAttendanceConfirmation('')).toBeUndefined()
  })

  test('industry matches presets case-insensitively and keeps custom text', () => {
    expect(normalizeIndustry('technology')).toBe('Technology')
    expect(normalizeIndustry('Space Mining')).toBe('Space Mining')
  })

  test('country names, codes and aliases become ISO codes', () => {
    expect(countryIsoFromInput('India')).toBe('IN')
    expect(countryIsoFromInput('ae')).toBe('AE')
    expect(countryIsoFromInput('UAE')).toBe('AE')
    expect(countryIsoFromInput('Atlantis')).toBeUndefined()
    expect(countryName('AE')).toBe('United Arab Emirates')
  })

  test('unrecognised values are dropped so database defaults apply', () => {
    const out = normalizeAttendeeFields({ full_name: 'A', country: 'Nowhere', registration_status: 'odd', attendance_confirmation: 'yes' })
    expect(out.country).toBeUndefined()
    expect(out.registration_status).toBeUndefined()
    expect(out.attendance_confirmation).toBe('confirmed')
  })
})

describe('import with the new columns', () => {
  const headers = ['First Name', 'Last Name', 'Email', 'Country', 'City', 'Sector', 'Status', 'RSVP']
  const rows = [
    ['Asha', 'Rao', 'asha@infosys.example', 'India', 'Bengaluru', 'technology', 'Approved', 'Yes'],
    ['Omar', 'Ali', 'omar@gmail.com', 'UAE', 'Dubai', 'Banking & Financial Services', 'pending', 'maybe'],
  ]

  test('columns are matched automatically', () => {
    expect(autoMapColumns(headers)).toEqual([
      'first_name', 'last_name', 'company_email', 'country', 'city', 'industry', 'registration_status', 'attendance_confirmation',
    ])
  })

  test('values are normalised and emails sorted by domain', () => {
    const guests = rowsToGuests(headers, rows, autoMapColumns(headers))
    expect(guests[0]).toMatchObject({ full_name: 'Asha Rao', company_email: 'asha@infosys.example', country: 'IN', industry: 'Technology', registration_status: 'approved', attendance_confirmation: 'confirmed' })
    expect(guests[1]).toMatchObject({ email: 'omar@gmail.com', country: 'AE', registration_status: 'pending', attendance_confirmation: 'maybe' })
    expect(guests[1]!.company_email).toBeUndefined()
  })

  test('duplicates are found across personal and corporate emails', () => {
    const existing = [{ id: 'x', registration_id: 'AAAAAA', full_name: 'Omar', email: null, company_email: 'OMAR@gmail.com', source: 'manual' }] as unknown as Guest[]
    const guests = rowsToGuests(headers, rows, autoMapColumns(headers))
    const conflicts = findDuplicates(guests, existing)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ rowIndex: 1, reason: 'email' })
    expect(planImport(guests, conflicts, {}).inserts).toHaveLength(1)
  })
})

describe('attendee CSV export', () => {
  test('includes the new columns with readable labels and escapes special characters', () => {
    const csv = toCsv(guestsToCsvRows([
      {
        id: '1', registration_id: 'A7K9Q2', full_name: 'Asha Rao', first_name: 'Asha', last_name: 'Rao', company: 'Acme, "Global"',
        country: 'IN', city: 'Bengaluru', industry: 'Technology', registration_status: 'approved', attendance_confirmation: 'maybe',
        created_at: '2026-10-27T10:00:00', source: 'manual',
      },
    ]))
    const [header, row] = csv.split('\r\n')
    expect(header).toContain('Country,City,Industry,Registration status,Attendance confirmation,Registration date')
    expect(row).toContain('"Acme, ""Global"""')
    expect(row).toContain('India,Bengaluru,Technology,Approved,Maybe,2026-10-27')
  })
})

describe('locations', () => {
  test('city suggestions exist for event countries', () => {
    expect(citiesFor('IN')).toContain('Bengaluru')
    expect(citiesFor('ae')).toContain('Dubai')
    expect(citiesFor('ZZ')).toEqual([])
  })

  test('country is detected from "City, Country" text', () => {
    expect(detectCountry('Bengaluru, India').iso).toBe('IN')
    expect(detectCountry('Dubai').iso).toBe('AE')
  })
})
