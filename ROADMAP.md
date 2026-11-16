# EventCheckin — Master Product Roadmap & To-Do List

This document represents the complete end-to-end product roadmap for **EventCheckin**, mapped directly against the 7 lifecycle stages of an event organizer.

---

## 🗺️ Master Lifecycle Roadmap

```
[ Stage 1: Setup & Tickets ] ──► [ Stage 2: Speakers & Agenda ] ──► [ Stage 3: Pass Delivery ]
                                                                             │
[ Stage 6: Sponsor Leads ]   ◄── [ Stage 5: Gate Arrivals ]     ◄── [ Stage 4: Morning Prep ]
           │
           ▼
[ Stage 7: Debrief & ROI ]
```

---

### 📋 Stage 1: Event Conceptualization & Ticketing Setup
- [ ] **1.1 Custom Registration Form Builder**
  - [ ] Add custom questions to registration forms (Text, Dropdown, Multi-select, Radio).
  - [ ] Standard presets: T-shirt size, Dietary/Allergies, LinkedIn Profile, "How did you hear about us?".
  - [ ] Field requirement toggles (Required vs. Optional).
- [ ] **1.2 Paid Ticketing & Payment Gateway Integration**
  - [ ] Stripe & Razorpay checkout integration for paid events.
  - [ ] Ticket tier pricing (e.g. *VIP Pass $199*, *Standard $49*, *Student $19*).
  - [ ] Promo codes & early bird discounts (e.g. `EARLYBIRD20` for 20% off).

---

### 🎤 Stage 2: Program Curation & Public Event Schedule
- [x] **2.1 Dedicated Speaker & Talk Session Management** *(Completed)*
  - [x] Speaker profiles, keynote/panel session tags, stage rooms, and headshot upload.
- [x] **2.2 Dedicated Sponsor & Custom Tier Hub** *(Completed)*
  - [x] Custom tier naming, booth allocations, pass quotas, and segregated team roster.
- [ ] **2.3 Public Conference Agenda & Schedule Page (`/schedule/[eventId]`)**
  - [ ] Interactive mobile-friendly timetable of talks, keynotes, stages, and times.
  - [ ] Speaker profile bio modals.
  - [ ] Sponsor showcase banner and booth floor map.

---

### ✉️ Stage 3: Attendee Acquisition & Automated Ticket Delivery
- [ ] **3.1 Automated Email Pass Delivery (via Resend)**
  - [ ] Automated branded HTML email pass with scannable QR ticket on registration / approval.
  - [ ] 1-Click **`[ ✉️ Send Passes to All Guests ]`** broadcast on the Guest Roster.
  - [ ] Individual **`[ Resend Ticket Pass ]`** button inside the Guest Drawer.
- [ ] **3.2 WhatsApp Digital Pass Delivery (via Meta Cloud API / Twilio)**
  - [ ] Instant ticket pass sent via WhatsApp with 98% open rate.
  - [ ] Event-morning reminder broadcast sent 2 hours before gates open.
  - [ ] 1-Click **`[ 💬 Broadcast Passes via WhatsApp ]`** on the Guest Roster.
- [ ] **3.3 SMS Ticket Pass Fallback (via Twilio / MSG91)**
  - [ ] Short-link SMS delivery for attendees without WhatsApp or mobile data.
- [ ] **3.4 Apple Wallet & Google Wallet Integration (PKPass)**
  - [ ] 1-Tap "Add to Apple Wallet / Google Wallet" badge passes.

---

### ⏰ Stage 4: Day-of-Event Morning Preparation (6 AM – 8 AM)
- [x] **4.1 Kiosk Station Pairing & Presence Monitoring** *(Completed)*
  - [x] 6-digit kiosk PIN pairing and real-time online presence counter.
- [x] **4.2 Sponsor Booth Teams Early Arrival Tracking** *(Completed)*
  - [x] Verify exhibitor staff are inside the venue before attendee gates open.
- [ ] **4.3 Automated Event-Morning Broadcast Reminder**
  - [ ] Automated WhatsApp/SMS broadcast 2 hours before gate opening with 1-click pass link to eliminate entrance panic.

---

### ⚡ Stage 5: Live Gate Arrivals & Fast-Track Printing (8 AM – 10:30 AM)
- [x] **5.1 Realtime Multi-Device Live Gate Station** *(Completed)*
  - [x] Sub-200ms real-time sync across tablets and front desk laptops.
  - [x] High-contrast QR camera scanner with audio/visual feedback.
  - [x] Double check-in prevention and fast walk-in registration.
- [ ] **5.2 Direct Thermal Silent Auto-Printing (Zero-Click Gate Printing)**
  - [ ] Live Gate Station toggle: `[✓] Auto-print badge immediately upon check-in`.
  - [ ] Zero-click silent printing via Chrome `--kiosk-printing` flag (sub-2-second prints).
  - [ ] Thermal presets: 4" × 3" fanfold with lanyard slot, 4" × 6", and continuous adhesive rolls.
  - [ ] 1-Tap **`[ 🖨️ Reprint Badge ]`** on attendee roster.
- [ ] **5.3 Multi-Track / Session Access Control (Hall & Workshop Gating)**
  - [ ] Multi-room scanning for specific halls (*Main Stage*, *Workshop Room A*, *VIP Lounge*).
  - [ ] Real-time access denial alerts if general attendees attempt to enter restricted sessions.
- [ ] **5.4 Offline Kiosk Mode & Background Queue Sync (PWA)**
  - [ ] Uninterrupted check-in during venue Wi-Fi outages with local IndexedDB queue and auto-sync.

---

### 💼 Stage 6: Sessions, Exhibition & Lead Retrieval (11 AM – 5 PM)
- [ ] **6.1 VIP, Speaker & Sponsor Instant Arrival Alerts**
  - [ ] Automated internal WhatsApp/SMS/Push notifications to organizers when VIPs arrive.
  - [ ] Dedicated "VIP Arrival Stream" on the Live Gate Station.
- [ ] **6.2 Sponsor Lead Retrieval (Booth Scanner App)**
  - [ ] Mobile web badge scanner for sponsors to scan visitor passes at their booths.
  - [ ] Lead qualification tags (*Hot Lead*, *Demo Requested*, *Decision Maker*) and custom notes.
  - [ ] Instant 1-click lead export for sponsors (CSV/Excel).
  - [ ] Paid add-on monetization model for organizers.
- [ ] **6.3 Live Announcements & Broadcasts**
  - [ ] Mid-day organizer broadcast alerts (*"Lunch is served in Hall B"*, *"Keynote starting in 10 mins"*).

---

### 📊 Stage 7: Debrief, Sponsor ROI & Event Duplication (Post-Event)
- [x] **7.1 Realtime KPI Dashboard & Export Reports** *(Completed)*
  - [x] Total roster, checked-in, walk-ins, no-shows.
  - [x] Multi-sheet formatted Excel report, CSV, and branded PDF attendance report.
- [ ] **7.2 Sponsor ROI Analytics Pack**
  - [ ] 1-Click post-event sponsor report (*"Your booth had 142 unique badge scans, 85 executives"*).
- [ ] **7.3 1-Click "Duplicate Event for Next Year"**
  - [ ] Clones branding, badge design templates, ticket tiers, and settings for the next edition.

---

## 🎯 Next Immediate Item to Tackle
* **Item 3.1: Automated Email Pass Delivery (via Resend)** — delivers instant digital ticket passes with QR codes to attendees' inboxes.
