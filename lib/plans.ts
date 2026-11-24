export type PlanTier = 'starter' | 'pro' | 'enterprise'

export interface PlanConfig {
  tier: PlanTier
  name: string
  priceLabel: string
  tagline: string
  badgeTone: 'default' | 'primary' | 'secondary'
  maxAttendeesPerEvent: number
  maxActiveEvents: number
  maxTeamSeats: number
  maxKiosks: number
  canUseBadgeStudioBack: boolean
  canExportCsv: boolean
  canManageSponsors: boolean
  canUseKiosks: boolean
  features: string[]
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: 'starter',
    name: 'Starter (Free)',
    priceLabel: '$0 / forever',
    tagline: 'Ideal for small gatherings, local meetups, and trial runs',
    badgeTone: 'secondary',
    maxAttendeesPerEvent: 75,
    maxActiveEvents: 1,
    maxTeamSeats: 1,
    maxKiosks: 1,
    canUseBadgeStudioBack: false,
    canExportCsv: false,
    canManageSponsors: false,
    canUseKiosks: false,
    features: [
      'Up to 75 attendees per event',
      '1 active event at a time',
      'Single user seat (organizer)',
      'Standard front badge layout',
      'Live gate station check-in',
      'Self-check-in digital pass',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro Organizer',
    priceLabel: '$49 / event or monthly',
    tagline: 'For summits, conferences, expos, and growing organizations',
    badgeTone: 'primary',
    maxAttendeesPerEvent: 1000,
    maxActiveEvents: 10,
    maxTeamSeats: 5,
    maxKiosks: 5,
    canUseBadgeStudioBack: true,
    canExportCsv: true,
    canManageSponsors: true,
    canUseKiosks: true,
    features: [
      'Up to 1,000 attendees per event',
      'Up to 10 active events simultaneously',
      'Up to 5 team member seats & staff roles',
      'Full Badge Studio (double-sided, Wi-Fi back, bleed guides)',
      'Full CSV attendee & audit logs export',
      'Sponsors & speakers delegate management',
      'Up to 5 live paired kiosk stations',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise / Agency',
    priceLabel: 'Custom',
    tagline: 'For large expos, multi-track summits, agencies & universities',
    badgeTone: 'default',
    maxAttendeesPerEvent: 100000,
    maxActiveEvents: 1000,
    maxTeamSeats: 1000,
    maxKiosks: 1000,
    canUseBadgeStudioBack: true,
    canExportCsv: true,
    canManageSponsors: true,
    canUseKiosks: true,
    features: [
      'Unlimited attendees & active events',
      'Unlimited team member seats & custom RBAC',
      'Unlimited kiosk pairing stations',
      'White-label passes & custom domains',
      'Priority organizer assistance',
    ],
  },
}

export function parsePlanTier(raw?: string | null): PlanTier {
  if (raw === 'pro' || raw === 'enterprise') return raw
  return 'starter'
}

export function getPlanConfig(raw?: string | null): PlanConfig {
  return PLAN_CONFIGS[parsePlanTier(raw)]
}

export function getEffectiveAttendeeLimit(tier?: string | null, override?: number | null): number {
  if (override != null && override > 0) return override
  return getPlanConfig(tier).maxAttendeesPerEvent
}

export function getEffectiveEventLimit(tier?: string | null, override?: number | null): number {
  if (override != null && override > 0) return override
  return getPlanConfig(tier).maxActiveEvents
}

export function canAddAttendee(
  currentGuestCount: number,
  tier?: string | null,
  override?: number | null
): boolean {
  return currentGuestCount < getEffectiveAttendeeLimit(tier, override)
}

export function canCreateEvent(
  activeEventCount: number,
  tier?: string | null,
  override?: number | null
): boolean {
  return activeEventCount < getEffectiveEventLimit(tier, override)
}

export const PAYPAL_COMMERCIALS = {
  priceUsd: 49,
  title: 'EventCheckin Pro License',
  // Official PayPal Hosted Payment link
  paypalMeUrl:
    process.env.NEXT_PUBLIC_PAYPAL_ME_URL ||
    'https://www.paypal.com/ncp/payment/3YMYLH3YAPDRA',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@eventcheckin.com',
}
