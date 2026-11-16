# EventCheckin — Feature Roadmap & Master To-Do List

This document outlines the high-priority missing features identified from competitive analysis, event organizer workflows, hardware integration, and day-of-event operations. We will work through these features step by step.

---

## 📋 Master To-Do List

### Phase 1: Automated Ticket & Pass Delivery System
> **Goal:** Eliminate lost passes, automate ticket delivery, and ensure 100% of attendees arrive at the gate with their QR pass ready on their phone.

- [ ] **1.1 Automated Email Pass Delivery (via Resend)**
  - [ ] Set up Resend transactional email API integration.
  - [ ] Design high-conversion HTML pass email with embedded event banner, date/venue, attendee details, and scannable QR pass.
  - [ ] Auto-trigger on new registration approval.
  - [ ] Bulk "Send Passes via Email" 1-click action button on `Guests & Roster` page.
  - [ ] Individual "Resend Pass Email" button in the Guest Drawer.

- [ ] **1.2 WhatsApp Digital Pass Delivery (via Meta Cloud API / Twilio / Wati)**
  - [ ] Connect WhatsApp Business API gateway.
  - [ ] Register pre-approved WhatsApp HSM ticket template (`Hi {{1}}, your pass for {{2}} is ready: {{3}}`).
  - [ ] Auto-send WhatsApp entry pass upon approval / registration.
  - [ ] "Event Morning Reminder" broadcast (sends 2 hours before gates open with 1-click pass access).
  - [ ] 1-Click "Broadcast Pass via WhatsApp" on Guests page.

- [ ] **1.3 SMS Ticket Fallback (via Twilio / MSG91)**
  - [ ] Short-link SMS pass delivery for attendees without WhatsApp or mobile data.
  - [ ] Configurable SMS sender ID.

---

### Phase 2: On-Site Gate & Thermal Hardware Printing
> **Goal:** Achieve sub-2-second badge printing per attendee and eliminate entrance queues.

- [ ] **2.1 Direct Thermal Silent Auto-Printing**
  - [ ] Live Gate Station toggle: `[✓] Auto-print badge immediately on check-in`.
  - [ ] Zero-click silent printing profile using Chrome `--kiosk-printing` flag.
  - [ ] Thermal template presets:
    - 4" × 3" (102mm × 76mm) fanfold badge with lanyard slot.
    - 4" × 6" (102mm × 152mm) conference pass.
    - Continuous adhesive sticker label rolls.
  - [ ] Instant 1-tap "Reprint Badge" button on attendee row for lost/damaged passes.

- [ ] **2.2 Multi-Track / Session Access Control (Hall & Workshop Gating)**
  - [ ] Track & room management under `PREPARE` (e.g. *Main Stage*, *Workshop Room A*, *VIP Lounge*).
  - [ ] Access permission rules per ticket tier or attendee.
  - [ ] Gate Station track selector: Volunteers select which room they are guarding.
  - [ ] Real-time access denial feedback with audio chime if a general attendee attempts to enter a restricted workshop or VIP area.

---

### Phase 3: Organizer & Sponsor Monetization Features
> **Goal:** Drive revenue for organizers and provide executive day-of-event intelligence.

- [ ] **3.1 VIP, Speaker & Sponsor Instant Arrival Alerts**
  - [ ] Automated push / WhatsApp notification to organizers when VIPs, Keynote Speakers, or Title Sponsors check in at the entrance.
  - [ ] Dedicated "VIP Arrival Stream" tab on the Live Gate Station.

- [ ] **3.2 Sponsor Lead Retrieval (Booth Scanner App)**
  - [ ] Lightweight booth scanning tool for sponsors to scan attendee badges using their smartphone camera.
  - [ ] Lead qualification tags (e.g. *Hot Lead*, *Demo Requested*, *Decision Maker*) and custom notes.
  - [ ] Instant "Export My Leads (CSV/Excel)" for sponsor booth leads.
  - [ ] Organizer revenue add-on (can be sold as a paid license per sponsor).

- [ ] **3.3 Offline Kiosk & Local Queue Sync (PWA)**
  - [ ] Service worker & local IndexedDB storage queue for gate tablets.
  - [ ] Full gate check-in functionality during venue Wi-Fi outages with automatic background cloud sync when connection restores.

---

## 🎯 Current Status & Next Feature to Tackle
* **Suggested Next Task:** **Feature 1.1 — Automated Email Pass Delivery (via Resend)** (easiest, highest volume, free to start, and sets up the base for digital pass delivery).
