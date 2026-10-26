import { generateEventId, generateRegistrationId, validateEmail } from '../lib/supabase'

describe('Event ID Generation', () => {
  test('generateEventId should create correct format', () => {
    const date = new Date('2026-11-15')
    const id = generateEventId('Tech Fest', 'Bengaluru', date)

    // Should be TECHFEST-BLR-15NOV2026
    expect(id).toMatch(/^[A-Z0-9]+-[A-Z0-9]+-\d{2}[A-Z]{3}\d{4}$/)
    expect(id).toContain('TECHFEST')
    expect(id).toContain('BLR')
    expect(id).toContain('15NOV2026')
  })

  test('generateEventId should handle special characters', () => {
    const date = new Date('2026-11-15')
    const id = generateEventId('Tech-Fest!', 'Bengaluru', date)

    // Should only contain letters, numbers, and hyphens
    expect(id).toMatch(/^[A-Z0-9-]+$/)
  })

  test('generateEventId should work with different locations', () => {
    const date = new Date('2026-11-15')
    const id1 = generateEventId('Tech Fest', 'Bengaluru', date)
    const id2 = generateEventId('Tech Fest', 'Delhi', date)
    const id3 = generateEventId('Tech Fest', 'Mumbai', date)

    // All should be different
    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
    expect(id1).not.toBe(id3)
  })

  test('generateEventId should work with different dates', () => {
    const id1 = generateEventId('Tech Fest', 'Bengaluru', new Date('2026-11-15'))
    const id2 = generateEventId('Tech Fest', 'Bengaluru', new Date('2026-12-15'))

    // Should be different
    expect(id1).not.toBe(id2)
  })
})

describe('Registration ID Generation', () => {
  test('generateRegistrationId should create 6-char alphanumeric', () => {
    const id = generateRegistrationId()

    expect(id).toHaveLength(6)
    expect(id).toMatch(/^[A-Z0-9]{6}$/)
  })

  test('generateRegistrationId should create unique IDs', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(generateRegistrationId())
    }

    // All should be unique (collision probability is negligible)
    expect(ids.size).toBe(100)
  })
})

describe('Email Validation', () => {
  test('validateEmail should accept valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('john.doe@company.co.uk')).toBe(true)
    expect(validateEmail('a@b.c')).toBe(true)
  })

  test('validateEmail should reject invalid emails', () => {
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
    expect(validateEmail('test@')).toBe(false)
    expect(validateEmail('test @example.com')).toBe(false)
  })
})
