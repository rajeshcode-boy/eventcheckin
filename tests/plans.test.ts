import { describe, expect, it } from 'vitest'
import {
  canAddAttendee,
  canCreateEvent,
  getEffectiveAttendeeLimit,
  getEffectiveEventLimit,
  getPlanConfig,
  parsePlanTier,
} from '@/lib/plans'

describe('Plan Commercials & Limitations', () => {
  it('defaults invalid or null tier to starter', () => {
    expect(parsePlanTier(null)).toBe('starter')
    expect(parsePlanTier(undefined)).toBe('starter')
    expect(parsePlanTier('random_tier')).toBe('starter')
    expect(parsePlanTier('pro')).toBe('pro')
    expect(parsePlanTier('enterprise')).toBe('enterprise')
  })

  it('provides starter limits correctly', () => {
    const starter = getPlanConfig('starter')
    expect(starter.maxAttendeesPerEvent).toBe(75)
    expect(starter.maxActiveEvents).toBe(1)
    expect(starter.maxTeamSeats).toBe(1)
    expect(starter.canExportCsv).toBe(false)
    expect(starter.canUseBadgeStudioBack).toBe(false)
  })

  it('provides pro limits correctly', () => {
    const pro = getPlanConfig('pro')
    expect(pro.maxAttendeesPerEvent).toBe(1000)
    expect(pro.maxActiveEvents).toBe(10)
    expect(pro.maxTeamSeats).toBe(5)
    expect(pro.canExportCsv).toBe(true)
    expect(pro.canUseBadgeStudioBack).toBe(true)
  })

  it('respects attendee overrides', () => {
    expect(getEffectiveAttendeeLimit('starter', null)).toBe(75)
    expect(getEffectiveAttendeeLimit('starter', 250)).toBe(250)
    expect(getEffectiveAttendeeLimit('pro', null)).toBe(1000)
    expect(getEffectiveAttendeeLimit('pro', 5000)).toBe(5000)
  })

  it('evaluates attendee addition boundary correctly', () => {
    expect(canAddAttendee(74, 'starter')).toBe(true)
    expect(canAddAttendee(75, 'starter')).toBe(false)
    expect(canAddAttendee(76, 'starter')).toBe(false)

    expect(canAddAttendee(75, 'starter', 100)).toBe(true)
    expect(canAddAttendee(100, 'starter', 100)).toBe(false)

    expect(canAddAttendee(999, 'pro')).toBe(true)
    expect(canAddAttendee(1000, 'pro')).toBe(false)
  })

  it('evaluates event creation boundary correctly', () => {
    expect(canCreateEvent(0, 'starter')).toBe(true)
    expect(canCreateEvent(1, 'starter')).toBe(false)
    expect(canCreateEvent(1, 'starter', 3)).toBe(true)
    expect(canCreateEvent(3, 'starter', 3)).toBe(false)

    expect(canCreateEvent(9, 'pro')).toBe(true)
    expect(canCreateEvent(10, 'pro')).toBe(false)
  })
})
