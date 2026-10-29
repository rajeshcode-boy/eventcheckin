// Per-event roles and what each one may do. Mirrors event_can() in SQL/020_event_roles.sql.
// This only decides what the UI shows. The database (Row Level Security) is what actually enforces it,
// so keep the two matrices in step when either changes.

export type EventRole = 'owner' | 'manager' | 'acquisition' | 'staff'
type MaybeRole = EventRole | null | undefined

export const EVENT_ROLES: EventRole[] = ['owner', 'manager', 'acquisition', 'staff']

export const ROLE_LABELS: Record<EventRole, string> = {
  owner: 'Owner',
  manager: 'Event manager',
  acquisition: 'Delegate acquisition',
  staff: 'Onsite staff',
}

export const ROLE_DESCRIPTIONS: Record<EventRole, string> = {
  owner: 'Full control, including deleting the event and naming other owners.',
  manager: 'Settings, team, badges, kiosks and guests. Cannot delete the event.',
  acquisition: 'Guest list only: view, add, edit and import.',
  staff: 'Gate and front desk: check-in, badge pickup and the live dashboard. Cannot edit guests or settings.',
}

export function isEventRole(value: unknown): value is EventRole {
  return typeof value === 'string' && (EVENT_ROLES as string[]).includes(value)
}

const is = (role: MaybeRole, allowed: EventRole[]) => !!role && allowed.includes(role)

export const canViewEvent = (role: MaybeRole) => is(role, EVENT_ROLES)
/** Event settings, schedule, venue, badge design, kiosk pairing. */
export const canManageEvent = (role: MaybeRole) => is(role, ['owner', 'manager'])
export const canDeleteEvent = (role: MaybeRole) => is(role, ['owner'])
export const canManageTeam = (role: MaybeRole) => is(role, ['owner', 'manager'])
/** Only an owner can name another owner. */
export const canAssignOwner = (role: MaybeRole) => is(role, ['owner'])
export const canViewGuests = (role: MaybeRole) => is(role, EVENT_ROLES)
/** Add, edit and import guests. */
export const canManageGuests = (role: MaybeRole) => is(role, ['owner', 'manager', 'acquisition'])
export const canDeleteGuests = (role: MaybeRole) => is(role, ['owner', 'manager'])
/** Kiosk scanner, manual check-in and badge pickup. */
export const canCheckIn = (role: MaybeRole) => is(role, ['owner', 'manager', 'staff'])
export const canViewReports = (role: MaybeRole) => is(role, ['owner', 'manager', 'staff'])

export interface EventSection {
  key: string
  /** Path after /events/[id] */
  href: string
  label: string
  allowed: (role: MaybeRole) => boolean
}

export const EVENT_SECTIONS: EventSection[] = [
  { key: 'overview', href: '', label: 'Overview', allowed: canViewEvent },
  { key: 'guests', href: '/guests', label: 'Guests', allowed: canManageGuests },
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', allowed: canViewReports },
  { key: 'badge-design', href: '/badge-design', label: 'Badge design', allowed: canManageEvent },
  { key: 'badges', href: '/badges', label: 'Badges', allowed: canManageEvent },
  { key: 'pickup', href: '/pickup', label: 'Pickup', allowed: canCheckIn },
  { key: 'team', href: '/team', label: 'Team', allowed: canManageTeam },
  { key: 'report', href: '/report', label: 'Report', allowed: canViewReports },
  { key: 'edit', href: '/edit', label: 'Settings', allowed: canManageEvent },
]

export const sectionsForRole = (role: MaybeRole) => EVENT_SECTIONS.filter((s) => s.allowed(role))

/** The section a path belongs to, e.g. "/events/abc/guests/import" -> guests. */
export function sectionForPath(pathname: string, base: string): EventSection | undefined {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : ''
  return EVENT_SECTIONS.filter((s) => s.href !== '' && (rest === s.href || rest.startsWith(s.href + '/')))[0]
    ?? EVENT_SECTIONS.find((s) => s.href === '' && (rest === '' || rest === '/'))
}

export function canOpenPath(role: MaybeRole, pathname: string, base: string): boolean {
  const section = sectionForPath(pathname, base)
  return section ? section.allowed(role) : canViewEvent(role)
}
