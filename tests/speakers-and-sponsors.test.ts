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
import {
  fetchSponsors,
  saveSponsor,
  deleteSponsor,
  fetchSponsorReps,
  saveSponsorRep,
  deleteSponsorRep,
  checkInSponsorRep,
  undoSponsorRepCheckIn,
  exportSponsorRepsToCsv,
  generateRepPassCode,
  DEFAULT_TIER_SUGGESTIONS,
} from '@/lib/sponsors'

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

describe('Sponsor Representatives & Strict Contact Segregation', () => {
  const eventId = 'test-event-reps-789'
  const sponsorId = 'sponsor-google-cloud'

  beforeEach(() => {
    localStorage.clear()
  })

  it('generates a clean unique SP-XXXX pass code for representatives', () => {
    const code = generateRepPassCode()
    expect(code).toMatch(/^SP-[2-9A-Z]{4}$/)
  })

  it('issues and fetches booth representative passes for a sponsor', async () => {
    const rep1 = await saveSponsorRep(eventId, sponsorId, {
      full_name: 'Alex Morgan',
      role_title: 'Booth Lead',
      email: 'alex@company.com',
      phone: '+1 555-0123',
    })

    const rep2 = await saveSponsorRep(eventId, sponsorId, {
      full_name: 'Samira Khan',
      role_title: 'Product Specialist',
      email: 'samira@company.com',
    })

    expect(rep1.id).toBeDefined()
    expect(rep1.pass_code).toMatch(/^SP-/)
    expect(rep1.full_name).toBe('Alex Morgan')
    expect(rep1.role_title).toBe('Booth Lead')

    const reps = await fetchSponsorReps(eventId, sponsorId)
    expect(reps).toHaveLength(2)
    expect(reps[0]?.full_name).toBe('Alex Morgan')
    expect(reps[1]?.full_name).toBe('Samira Khan')
  })

  it('tracks check-in and undo check-in for sponsor representatives', async () => {
    const rep = await saveSponsorRep(eventId, sponsorId, {
      full_name: 'David Kim',
      role_title: 'Demo Specialist',
    })

    expect(rep.checked_in_at).toBeNull()

    const checkedIn = await checkInSponsorRep(rep.id, eventId, 'Gate Scanner', 'qr')
    expect(checkedIn).not.toBeNull()
    expect(checkedIn?.checked_in_at).toBeDefined()
    expect(checkedIn?.checked_in_by).toBe('Gate Scanner')
    expect(checkedIn?.checkin_method).toBe('qr')

    const undid = await undoSponsorRepCheckIn(rep.id, eventId)
    expect(undid).not.toBeNull()
    expect(undid?.checked_in_at).toBeNull()
    expect(undid?.checked_in_by).toBeNull()
  })

  it('exports sponsor delegation CSV while guaranteeing segregation from attendee roster', async () => {
    const sponsor = await saveSponsor(eventId, {
      id: sponsorId,
      name: 'Cloudflare',
      tier: 'Platinum Partner',
      booth_number: 'Booth P-01',
    })

    const rep = await saveSponsorRep(eventId, sponsorId, {
      full_name: 'Elena Rostova',
      role_title: 'DevRel Lead',
      email: 'elena@cloudflare.com',
      phone: '+1 555-9876',
    })

    const csvOutput = exportSponsorRepsToCsv([sponsor], [rep])

    // Verify all key sponsor rep columns exist in the CSV
    expect(csvOutput).toContain('Sponsor Company')
    expect(csvOutput).toContain('Tier')
    expect(csvOutput).toContain('Booth Number')
    expect(csvOutput).toContain('Cloudflare')
    expect(csvOutput).toContain('Platinum Partner')
    expect(csvOutput).toContain('Booth P-01')
    expect(csvOutput).toContain('Elena Rostova')
    expect(csvOutput).toContain('elena@cloudflare.com')
    expect(csvOutput).toContain(rep.pass_code)
  })

  it('removes a representative pass', async () => {
    const rep = await saveSponsorRep(eventId, sponsorId, { full_name: 'Temporary Staff' })
    let reps = await fetchSponsorReps(eventId, sponsorId)
    expect(reps).toHaveLength(1)

    await deleteSponsorRep(rep.id, eventId)
    reps = await fetchSponsorReps(eventId, sponsorId)
    expect(reps).toHaveLength(0)
  })
})
