import {
  canAssignOwner, canCheckIn, canDeleteEvent, canDeleteGuests, canManageEvent, canManageGuests, canManageTeam,
  canOpenPath, canViewGuests, canViewReports, EVENT_ROLES, isEventRole, sectionForPath, sectionsForRole,
  type EventRole,
} from '../lib/permissions'

const matrix: Record<string, Record<EventRole, boolean>> = {
  canManageEvent: { owner: true, manager: true, acquisition: false, staff: false },
  canDeleteEvent: { owner: true, manager: false, acquisition: false, staff: false },
  canManageTeam: { owner: true, manager: true, acquisition: false, staff: false },
  canAssignOwner: { owner: true, manager: false, acquisition: false, staff: false },
  canViewGuests: { owner: true, manager: true, acquisition: true, staff: true },
  canManageGuests: { owner: true, manager: true, acquisition: true, staff: false },
  canDeleteGuests: { owner: true, manager: true, acquisition: false, staff: false },
  canCheckIn: { owner: true, manager: true, acquisition: false, staff: true },
  canViewReports: { owner: true, manager: true, acquisition: false, staff: true },
}
const fns = { canManageEvent, canDeleteEvent, canManageTeam, canAssignOwner, canViewGuests, canManageGuests, canDeleteGuests, canCheckIn, canViewReports }

describe('permission matrix', () => {
  for (const [name, expected] of Object.entries(matrix)) {
    it(name, () => {
      for (const role of EVENT_ROLES) expect(fns[name as keyof typeof fns](role)).toBe(expected[role])
    })
  }
  it('denies everything without a role', () => {
    for (const fn of Object.values(fns)) {
      expect(fn(null)).toBe(false)
      expect(fn(undefined)).toBe(false)
    }
  })
})

describe('event sections by role', () => {
  const keys = (r: EventRole | null) => sectionsForRole(r).map((s) => s.key)
  it('owner and manager see every tab', () => {
    expect(keys('owner')).toHaveLength(9)
    expect(keys('manager')).toEqual(keys('owner'))
  })
  it('acquisition sees guests but not team or settings', () => {
    expect(keys('acquisition')).toEqual(['overview', 'guests'])
  })
  it('staff sees pickup and live reports but not guests or settings', () => {
    expect(keys('staff')).toEqual(['overview', 'dashboard', 'pickup', 'report'])
  })
  it('no role sees nothing', () => expect(keys(null)).toEqual([]))
})

describe('route guard', () => {
  const base = '/events/abc'
  it('maps nested paths to their section', () => {
    expect(sectionForPath('/events/abc/guests/import', base)?.key).toBe('guests')
    expect(sectionForPath('/events/abc', base)?.key).toBe('overview')
    expect(sectionForPath('/events/abc/edit', base)?.key).toBe('edit')
  })
  it('blocks pages outside the role', () => {
    expect(canOpenPath('staff', '/events/abc/guests', base)).toBe(false)
    expect(canOpenPath('staff', '/events/abc/edit', base)).toBe(false)
    expect(canOpenPath('acquisition', '/events/abc/team', base)).toBe(false)
    expect(canOpenPath('staff', '/events/abc/pickup', base)).toBe(true)
    expect(canOpenPath('manager', '/events/abc/team', base)).toBe(true)
  })
})

describe('isEventRole', () => {
  it('accepts the four roles only', () => {
    expect(EVENT_ROLES.every(isEventRole)).toBe(true)
    expect(isEventRole('admin')).toBe(false)
    expect(isEventRole('check_in')).toBe(false)
    expect(isEventRole(null)).toBe(false)
  })
})
