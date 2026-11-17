# EventCheckin — Design System & Visual Identity Specification

This document defines the complete visual identity, design tokens, color palette, typography, spacing scale, and component rules for the **EventCheckin** web platform.

---

## 1. Visual Identity & Brand Tone

* **Core Purpose:** High-speed on-site event operations, seamless gate check-in, real-time ticket management, badge printing, speaker curation, and sponsor partnership tracking.
* **Brand Personality:** Fast, trustworthy, utilitarian, crisp, modern SaaS.
* **Visual Atmosphere:** High-contrast emerald green accents paired with neutral slate surfaces, generous rounded corners, and clear legibility under bright outdoor daylight and dim conference hall lighting.
* **Theme Support:** **Light by default**; Dark mode is explicitly opt-in via user toggle (`[data-theme="dark"]`).

---

## 2. Color Palette & Token System

### 2.1 Brand & Semantic Colors

| Token | Light Mode (`:root`) | Dark Mode (`[data-theme="dark"]`) | Usage |
| :--- | :--- | :--- | :--- |
| **Primary (Brand)** | `#059669` (Emerald 600) | `#10B981` (Emerald 500) | Primary buttons, active states, key highlights |
| **Primary Hover** | `#047857` (Emerald 700) | `#34D399` (Emerald 400) | Hovered primary interactions |
| **Primary Soft (Tint)** | `#ECFDF5` (Emerald 50) | `#064E3B` (Emerald 900) | Selected item backgrounds, icon backdrops |
| **Primary Foreground** | `#FFFFFF` | `#022C22` (Deep Green) | Text/icons on primary buttons |
| **Live / Radar Accent** | `#10B981` (Emerald 500) | `#34D399` (Emerald 400) | Live gate station indicators, active pulses |
| **Live Soft** | `#D1FAE5` (Emerald 100) | `#064E3B` | Live badges, synced state badges |
| **Amber Warning** | `#F59E0B` (Amber 500) | `#FBBF24` (Amber 400) | Pending registrations, walk-ins, quota warnings |
| **Error / Destructive** | `#EF4444` (Red 500) | `#F87171` (Red 400) | Rejected status, delete actions, check-in errors |
| **Surface (Card)** | `#FFFFFF` | `#121820` (Dark Slate) | Container cards, popovers, modals |
| **Surface Muted** | `#F1F5F9` (Slate 100) | `#1A232D` | Table headers, secondary buttons, subtle wells |
| **Background (Page)** | `#F8FAFC` (Slate 50) | `#0B0F14` (Obsidian) | Full page background |
| **Border / Input** | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | Dividers, card strokes, form field outlines |
| **Text Primary** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Primary headings, titles, active labels |
| **Text Secondary** | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Subtitles, metadata, timestamps, captions |

---

### 2.2 Status Indicators & Badge Color Rules

Used uniformly across tables, custom dropdowns, cards, and scanner results:

* **Approved / Confirmed / Check-in:**
  * Dot: `bg-emerald-500`
  * Badge: `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20`
* **Registered (Pre-approved):**
  * Dot: `bg-blue-500`
  * Badge: `bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20`
* **Pending / Maybe / Review:**
  * Dot: `bg-amber-500`
  * Badge: `bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20`
* **Rejected / Cancelled / Error:**
  * Dot: `bg-rose-500`
  * Badge: `bg-destructive/10 text-destructive border-destructive/20`
* **Sponsor / Custom Tiers:**
  * Dot: `bg-purple-500`
  * Badge: `bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20`
* **Inactive / Unconfirmed / Quiet:**
  * Dot: `bg-slate-400`
  * Badge: `bg-muted text-muted-foreground border-border`

---

## 3. Typography Hierarchy

* **Primary Typeface:** `Geist` via `next/font/google` (`--font-sans`).
* **Fallback Stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`.
* **Monospace Typeface:** System monospace / `font-mono` (used strictly for Registration IDs, Pass Codes `SP-XXXX`, and Event IDs).

### Type Scale:

| Level | Tailwind Classes | Typical Usage |
| :--- | :--- | :--- |
| **Display / Page H1** | `text-2xl sm:text-3xl font-extrabold tracking-tight` | Event Overview header, Gate Station title |
| **Section Header (H2)** | `text-lg sm:text-xl font-bold` | Tab headings, modal titles, drawer headers |
| **Card Title (H3)** | `text-base font-bold` or `text-sm font-bold leading-snug` | KPI Card titles, Sponsor cards, Attendee names |
| **Base Body** | `text-sm font-medium` | General UI labels, descriptions, table body |
| **Compact Body** | `text-xs font-normal` | Form labels, input fields, subtext, table sub-lines |
| **Badge / Caption / Tag** | `text-[10px]` or `text-[11px] font-bold uppercase tracking-wider` | Role badges, status pills, quota indicators |
| **Code Snippet / ID** | `font-mono font-bold text-xs` | Registration codes (`SP-7K2M`), Event IDs |

---

## 4. Spacing, Elevation & Corner Radii

### 4.1 Corner Radii Scale
EventCheckin uses progressive organic rounding:

* `rounded-lg` (8px): Compact form inputs, icon buttons.
* `rounded-xl` (12px): Standard inputs, modal content wells, table row items.
* `rounded-2xl` (16px): KPI metric cards, CustomSelect popover menus, attendee cards.
* `rounded-3xl` (24px): Hero containers, major layout sections, Gate command box.
* `rounded-full`: Action pills, status badges, avatar pictures, toggle switches.

### 4.2 Elevation & Shadows
* **Subtle Card:** `shadow-2xs` / `shadow-xs` — subtle outline elevation for dashboard cards.
* **Standard Card:** `var(--shadow-card)` (`0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)`).
* **Floating Popover / Modal:** `var(--shadow-pop)` / `shadow-xl` / `shadow-2xl` paired with `backdrop-blur-md` for floating dropdowns and dialog overlays.

### 4.3 Touch Target & Density Standards
* **Desktop / Desk Mode:** Compact 36px–40px heights (`h-9` or `h-10`) for maximum information density on large screens.
* **On-Site Kiosk / Touch Target:** Minimum `44px` height (`min-h-touch`) on all scanner buttons and self-check-in elements for tap reliability.

---

## 5. UI Component Design Rules

### 5.1 Buttons (`components/ui/button.tsx`)
* **Primary:** `bg-primary text-primary-foreground hover:bg-primary/80 shadow-xs`. Rounded-full for primary action launches; rounded-xl for standard forms.
* **Outline:** `border-border bg-card text-foreground hover:bg-muted`.
* **Destructive:** `bg-destructive/10 text-destructive hover:bg-destructive/20`.
* **Ghost:** `hover:bg-muted text-muted-foreground hover:text-foreground`.

### 5.2 Form Inputs (`components/ui/input.tsx`)
* Height: `h-9` or `h-10` with `rounded-xl` borders.
* Focus Ring: `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50`.
* Placeholder: `placeholder:text-muted-foreground text-xs`.

### 5.3 Custom Floating Dropdowns (`components/ui/custom-select.tsx`)
* **Trigger:** Rounded-2xl card trigger with active selection label, colored status dot (if applicable), and an animated `ChevronDown` that rotates 180° when opened.
* **Popover Menu:** Floating glass container (`rounded-2xl border border-border bg-popover shadow-xl p-1.5 backdrop-blur-md animate-in fade-in-0 zoom-in-95`).
* **Option Item:** Rounded-xl item with hover highlight (`hover:bg-muted`) and active checkmark (`✓`). Auto-closes on click outside or `Escape`.

### 5.4 Toggle Switches (`components/ui/switch.tsx`)
* Track: Smooth 44px wide rounded-full capsule (`h-6 w-11`).
* Active State: Emerald green track (`bg-emerald-600 dark:bg-emerald-500`).
* Inactive State: Muted track (`bg-muted-foreground/30`).
* Knob: Smooth sliding white circular thumb (`size-5 translate-x-5`).

### 5.5 Inline Alerts (`components/ui/alert.tsx`)
* Left accent border strip (`border-l-4`).
* Variants:
  * **Success:** `border-primary bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200`.
  * **Warning:** `border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200`.
  * **Error:** `border-destructive bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200`.

---

## 6. Motion & Animation Standards

* **Radar Live Ping:** `.animate-ping` on a 2px emerald dot inside Live status badges.
* **Kiosk Success Flash:** Keyframed CSS spring animation (`kiosk-flash-pop`, `kiosk-flash-check`) for sub-second visual validation upon badge scan.
* **Camera Scanner Sweep:** Continuous vertical laser animation (`scanner-sweep`, 2s ease-in-out) inside the camera viewport.
* **Reduced Motion:** All decorative animations respect `@media (prefers-reduced-motion: reduce)`.
