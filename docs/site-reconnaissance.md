# CourtReserve Site Reconnaissance

Documented: 2026-03-20 from user-provided screenshots.

## 1. Login Page

**URL:** `https://app.courtreserve.com/Online/Account/Login/10243` (estimated)

| Element | Selector Strategy |
|---------|------------------|
| Email input | label "Email" → `input` sibling |
| Password input | label "Password" → `input` sibling |
| Continue button | `button` with text "Continue" |
| Remember Me | checkbox labeled "Remember Me" |

**Notes:**
- Also has "Request a Code" and "Continue with Google" — we use email/password only.
- Post-login redirect: likely to the reservations grid page.

## 2. Availability Grid

**URL:** `https://app.courtreserve.com/Online/Reservations/Index/10243` (confirmed from CLAUDE.md)

### Courts (7 total)
| Column | Court Name | Type |
|--------|-----------|------|
| 1 | Court #1 (Singles Court) | Singles |
| 2 | Court #2 | Doubles |
| 3 | Court #3 | Doubles |
| 4 | Court #4 | Doubles |
| 5 | Court #5 | Doubles |
| 6 | Court #6 | Doubles |
| 7 | Court #7 | Doubles |

### Grid Structure
- **Columns:** One per court (7 columns)
- **Rows:** 30-minute increments, visible range: 11:00 AM — 11:30 PM
- **Date navigation:** "TODAY" button, left/right arrows, date picker
- **Refresh button** (circular arrow icon, top right)

### Cell States
| Color | Meaning | Clickable? |
|-------|---------|------------|
| Gray | "Reserved" (existing booking) | No (just text) |
| Green | Class/clinic with spots remaining | Yes (has "Details" link) |
| Pink/Red | FULL class (no spots) | Yes (has "Join Waitlist") |
| White/empty | Available for booking | Yes — clicking opens booking modal |
| Blue/Cyan | Specific event type | Unknown |

### Bottom Row
- Available courts show a "Reserve" button at the 11:30 PM row
- This is the last bookable slot

### Key Observations
- Time range visible goes from 11:00 AM to 11:30 PM (may scroll earlier)
- The grid is likely a table or div-grid structure
- Court labels appear as column headers with court number and type

## 3. Booking Modal

**Trigger:** Click an available (white/empty) cell in the grid

**Modal title format:** `"Book a reservation for {M/DD/YYYY} | {Type} - Court #{N}"`

| Field | Type | Example Value | Required? |
|-------|------|--------------|-----------|
| Reservation Type | Dropdown | "Court Reservation" | Yes (marked *) |
| Start Time | Text input | "11:30 PM" (12h format) | Pre-filled from clicked cell |
| Duration | Dropdown | "30 minutes" | Yes (marked *) |
| End Time | Text (computed) | "12:00 AM" | Auto-calculated, read-only |
| Additional Player(s) | Search input | "Search for other player(s)..." | No |
| Disclosure checkbox | Checkbox | "Check to agree to above disclosure" | Likely required |

**Players table:** Shows current user (#1 Dustin Zhang) with Cost and Due columns.

**Buttons:** "Close" and "Save" (blue) — both in header and footer.

**Cost:** $25.00 per reservation shown. "You will have 15 minutes to pay for this reservation."

### Critical Booking Flow
1. Click empty cell → modal opens with pre-filled start time and court
2. Set Duration via dropdown (default appears to be 30 minutes)
3. Check the disclosure checkbox
4. Click "Save"

## 4. My Reservations Page

**URL:** Likely accessible via nav menu (user dropdown) or direct URL

### Filters (Left Sidebar)
- **Show:** Reservations, Lessons, Classes - Registered, Classes - Waitlist (all checkboxes, all checked)
- **Date:** Today, Tomorrow, Next 7 Days, Next 30 Days (radio buttons, "Next 30 Days" selected), Custom

### Booking Cards
- **Tabs:** Active / Cancelled
- **Count header:** "N Booking Found"
- **Card content:**
  - Type badge: "Court Reservation" (with blue dot)
  - Date/time: "Mon, Mar 23rd, 10:30 PM - 11:30 PM"
  - Player name: "Dustin Zhang"
  - Court: "Court #2"
  - "Edit Reservation" button

### Idempotency Check Strategy
1. Navigate to My Reservations page
2. Filter to relevant date range
3. Scrape all booking cards
4. Check if any match the requested date, time, and court
5. If match found → skip booking, notify "already booked"

## 5. Corrections to Original Plan

Based on reconnaissance, the following assumptions were WRONG and need updating:

| Assumption | Reality | Impact |
|-----------|---------|--------|
| Opening time: 06:00 | Grid shows 11:00 AM earliest | Update OPENING_TIME |
| Closing time: 21:00 | Last slot: 11:30 PM | Update CLOSING_TIME |
| Durations: 60, 90, 120 min | Site offers 30-minute duration dropdown | Add 30 min option |
| Courts: generic | 7 specific courts (#1-#7) | Court type from header text |
| Simple click-to-book | Modal with disclosure checkbox required | Must check checkbox before save |
| Free booking | $25.00 per reservation | Informational, no payment automation needed |

## 6. robots.txt

**Status:** Not yet checked. Must fetch `https://app.courtreserve.com/robots.txt` before first automated access.
