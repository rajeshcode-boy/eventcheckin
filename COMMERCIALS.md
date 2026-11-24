# Commercial Limitations & Licensing Plan

This document outlines the commercial pricing tiers, plan limitations, and PayPal payment & license key activation architecture for **EventCheckin**.

---

## 1. Commercial Pricing Tiers

| Limit / Feature | **Starter (Free)** | **Pro Organizer (\$49)** | **Enterprise / Agency** |
| :--- | :--- | :--- | :--- |
| **Audience** | Meetups, local clubs, trial runs | Conferences, expos, corporate summits | Event agencies, large multi-track expos |
| **Price** | **\$0 / free forever** | **\$49 / event or monthly** | **Custom / \$299+** |
| **Max Attendees per Event** | **75 attendees** | **1,000 attendees** | **Unlimited (10,000+)** |
| **Active Events** | **1 event** | **10 events** | **Unlimited** |
| **Team Member Seats** | **1 seat** (Owner only) | **5 team members** | **Unlimited** |
| **Badge Studio** | Standard front-only template | Double-sided (Wi-Fi, Agenda, Bleed, Lanyard) | Full Studio + custom white-label |
| **CSV Data Export** | 🔒 Locked (Upgrade required) | ✅ Full CSV attendee & audit logs | ✅ Full CSV + raw database logs |
| **Live Check-in Kiosks** | 1 station | Up to 5 simultaneous stations | Unlimited stations & offline sync |
| **Sponsors & Speakers** | ❌ Locked | Up to 5 sponsors, 10 speakers | Unlimited |
| **Branding** | *"Powered by EventCheckin"* badge | Remove watermark & custom colors | Custom domains & white-label passes |

---

## 2. Enforcement Mechanisms

Limitations are enforced at multiple levels to guarantee security and a clean user experience:

### A. Pre-Event Hard Caps
- **Attendee Limits:** Adding attendee #76 on Starter triggers an upgrade prompt blocking the creation until upgraded to Pro. CSV imports that exceed remaining quota calculate available spots and warn the organizer.
- **Active Events Quota:** Creating a second active event on Starter is prevented with an option to archive previous events or upgrade to Pro.
- **Team Size:** Clicking `+ Invite Teammate` checks seat count against the tier's `maxTeamSeats` (1 for Starter, 5 for Pro).

### B. Feature Gating
- **CSV Export:** The "Export CSV" buttons in the guest roster verify `planConfig.canExportCsv`. Starter users clicking export receive an upgrade modal explaining Pro data export features.
- **Badge Studio Back-of-Badge:** The double-sided Wi-Fi and agenda badge layout has a prominent "Pro" indicator.

### C. Live Event Safeguards
- Live check-ins at gates and QR code scans are **never blocked** during an ongoing event even if walk-in volume slightly exceeds caps. Organizers receive soft warnings so on-site operations are never halted.

---

## 3. PayPal Payment & Activation Workflows

Since Stripe or automated merchant gateways may not be configured yet, payments are processed via PayPal with two flexible upgrade methods:

### Workflow A: Direct 1-Click Upgrade (Admin Panel)
1. **User Action:** User clicks **"Upgrade to Pro"** in the app.
2. **Payment:** The modal displays the \$49 price and a **"Pay via PayPal"** button linking to `paypal.me/yourusername/49`.
3. **Note:** The user inputs their organization name or email in the PayPal transfer note.
4. **Activation:** You log in to `/admin` (Master Admin), locate their organization in the roster, and click **`Pro`** under the **Tier Switcher**. The account immediately upgrades to Pro.

### Workflow B: License Key Activation (`PRO-XXXX-XXXX-XXXX`)
1. **Generation:** In `/admin` under **"PayPal License Keys"**, click **"+ Create License Key"**, enter a customer note (e.g. `PayPal $49 tx #...`), and copy the generated key.
2. **Delivery:** Send the license code to the customer.
3. **Redemption:** The customer enters the key either:
   - In the **"Redeem License Key"** box on `/organization`, or
   - Directly inside the **"Upgrade to Pro"** popup modal.
4. **Auto-Upgrade:** `redeem_license_key()` verifies the key, links it to the organization, and activates Pro instantly.

---

## 4. Technical Architecture

### Database Schema (`SQL/027_plans_and_licenses.sql`)
- `organizations.plan_tier`: Enum string (`starter`, `pro`, `enterprise`).
- `organizations.max_attendees_override`: Optional custom integer override.
- `organizations.max_events_override`: Optional custom integer override.
- `license_keys`: Stores key string, target tier, expiration/duration, redemption status, and notes.
- `redeem_license_key(p_key)`: Secure PostgreSQL function validating and applying license keys.
- `admin_set_organization_plan(org_id, tier, max_attendees, max_events)`: Master admin RPC for 1-click upgrades.
- `admin_generate_license_key(tier, notes, duration)`: Master admin RPC to create codes.

### Codebase Components
- `lib/plans.ts`: Core plan configuration object `PLAN_CONFIGS` and helper functions (`canAddAttendee`, `canCreateEvent`, `getPlanConfig`).
- `components/UpgradeModal.tsx`: Reusable modal displaying tier comparison, PayPal link, and license key input.
- `app/(app)/admin/page.tsx`: Master admin dashboard with organization tier switcher and license key manager.
- `app/(app)/organization/page.tsx`: Plan status card, live usage meters, and license redemption.
- `app/(app)/events/[id]/guests/page.tsx`: Attendee capacity meter and feature gates.
- `components/EventForm.tsx`: Active event limit enforcement.

---

## 5. Environment Variables

Configure these in `.env.local` and in your deployment settings (e.g. Vercel):

```env
# PayPal payment link (e.g. your PayPal.Me link with amount)
NEXT_PUBLIC_PAYPAL_ME_URL=https://paypal.me/yourusername/49

# Support contact for invoice or billing inquiries
NEXT_PUBLIC_SUPPORT_EMAIL=support@eventcheckin.com
```

---

## 6. How to Apply Migration

1. Go to your Supabase project dashboard -> **SQL Editor**.
2. Open and run `SQL/027_plans_and_licenses.sql`.
3. Existing organizations will automatically default to the `starter` tier.
4. Use `/admin` to upgrade any existing test accounts to `pro`.
