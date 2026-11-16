import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase client to gracefully return table not found
const queryBuilder: any = {
  select: () => queryBuilder,
  insert: () => queryBuilder,
  update: () => queryBuilder,
  delete: () => queryBuilder,
  eq: () => queryBuilder,
  order: () => queryBuilder,
  single: () => Promise.resolve({ data: null, error: { message: 'table not found' } }),
  then: (resolve: any) => resolve({ data: null, error: { message: 'table not found' } }),
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => queryBuilder,
  },
}))

import { fetchSpeakers, saveSpeaker, deleteSpeaker, type Speaker } from '@/lib/speakers'
import { fetchSponsors, saveSponsor, deleteSponsor, DEFAULT_TIER_SUGGESTIONS } from '@/lib/sponsors'

// Polyfill localStorage for node environment
const store = new Map<string, string>()
if (typeof globalThis.window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}

describe('Speaker Management', () => {
  const eventId = 'test-event-uuid-123'

  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and fetches a speaker with talk session details', async () => {
    const speaker = await saveSpeaker(eventId, {
      full_name: 'Dr. Jane Doe',
      designation: 'Chief Scientist',
      company: 'Neural Research',
      talk_title: 'The Future of Agentic AI',
      session_type: 'Keynote',
      stage_room: 'Main Auditorium',
      session_time: '10:00 AM - 10:45 AM',
    })

    expect(speaker.id).toBeDefined()
    expect(speaker.full_name).toBe('Dr. Jane Doe')
    expect(speaker.session_type).toBe('Keynote')
    expect(speaker.stage_room).toBe('Main Auditorium')

    const list = await fetchSpeakers(eventId)
    expect(list).toHaveLength(1)
    expect(list[0]?.talk_title).toBe('The Future of Agentic AI')
  })

  it('updates an existing speaker', async () => {
    const created = await saveSpeaker(eventId, {
      full_name: 'John Smith',
      session_type: 'Panel',
    })

    const updated = await saveSpeaker(eventId, {
      id: created.id,
      full_name: 'John Smith, PhD',
      session_type: 'Breakout',
    })

    expect(updated.full_name).toBe('John Smith, PhD')
    expect(updated.session_type).toBe('Breakout')

    const list = await fetchSpeakers(eventId)
    expect(list).toHaveLength(1)
    expect(list[0]?.full_name).toBe('John Smith, PhD')
  })

  it('deletes a speaker', async () => {
    const speaker = await saveSpeaker(eventId, { full_name: 'Mark Taylor' })
    let list = await fetchSpeakers(eventId)
    expect(list).toHaveLength(1)

    await deleteSpeaker(eventId, speaker.id)
    list = await fetchSpeakers(eventId)
    expect(list).toHaveLength(0)
  })
})

describe('Sponsor Management & Custom Tiers', () => {
  const eventId = 'test-event-uuid-456'

  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default tier suggestions for organizers', () => {
    expect(DEFAULT_TIER_SUGGESTIONS).toContain('Title Partner')
    expect(DEFAULT_TIER_SUGGESTIONS).toContain('Platinum Sponsor')
    expect(DEFAULT_TIER_SUGGESTIONS).toContain('Powered By')
  })

  it('saves and fetches a sponsor with a custom tier name', async () => {
    const customTierName = 'Exclusive Lanyard & Coffee Sponsor'
    const sponsor = await saveSponsor(eventId, {
      name: 'Coffee Labs Global',
      tier: customTierName,
      booth_number: 'Lobby Lounge 1',
      website: 'https://coffeelabs.io',
      rep_pass_quota: 4,
    })

    expect(sponsor.id).toBeDefined()
    expect(sponsor.name).toBe('Coffee Labs Global')
    expect(sponsor.tier).toBe(customTierName)
    expect(sponsor.rep_pass_quota).toBe(4)

    const list = await fetchSponsors(eventId)
    expect(list).toHaveLength(1)
    expect(list[0]?.tier).toBe(customTierName)
  })

  it('deletes a sponsor', async () => {
    const sponsor = await saveSponsor(eventId, {
      name: 'Tech Ventures',
      tier: 'Gold Sponsor',
    })

    let list = await fetchSponsors(eventId)
    expect(list).toHaveLength(1)

    await deleteSponsor(eventId, sponsor.id)
    list = await fetchSponsors(eventId)
    expect(list).toHaveLength(0)
  })
})
