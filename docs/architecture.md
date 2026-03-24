# Architecture

## Overview

Tennis Booker is a CLI tool that automates booking tennis courts on CourtReserve. It uses Playwright for browser automation against a Kendo UI-based web application.

**Stack:** Node.js + TypeScript + Playwright + Zod + Anthropic SDK (for natural language parsing)

## Directory Structure

```
src/
  index.ts              Main entry point -- orchestrates the full booking pipeline
  config.ts             Environment variable validation (Zod schema)
  types.ts              Core TypeScript types (Court, TimeSlot, SlotRequest, BookingResult)
  prompts.ts            CLI argument parsing + interactive prompts + validation
  nl-parser.ts          Natural language command parsing via Claude Haiku
  notifier.ts           Console-based result notifications with ANSI colors
  retry.ts              Generic exponential backoff retry utility
  time-utils.ts         HH:MM format <-> minutes conversion helpers
  court-selector.ts     Court preference sorting (doubles first, lowest ID)
  slot-suggester.ts     Alternative slot suggestions (nearest by time proximity)
  booking-window.ts     7-day advance booking window calculation + countdown wait
  calendar.ts           Google Calendar API integration (OAuth + event creation)

  browser/
    client.ts           Playwright browser launch/close, timeouts, viewport config
    auth.ts             CourtReserve login flow + validation
    selectors.ts        CSS/Playwright selector constants grouped by page
    availability.ts     Kendo Scheduler date navigation + reserve button extraction
    booking.ts          Booking modal interaction (duration dropdown, disclosure, save)
    payment.ts          Payment page navigation + auto-pay processing
    reservations.ts     My Reservations page parsing for existing bookings

tests/
  unit/                 Individual function tests
  integration/          Browser interaction tests
  e2e/                  Full booking flow tests
  fixtures/             Mock data

docs/
  architecture.md       This file
  site-reconnaissance.md  CourtReserve site analysis and DOM documentation
  robots.txt            Site robots.txt (disallow all)
```

## Data Flow

```
CLI args / Interactive prompts / Natural language (--command)
  |
  v
SlotRequest { date, startTime, durationMinutes }
  |
  v
[If advance booking: wait for 7-day window to open with countdown]
  |
  v
Launch Playwright browser (headless in prod, headed if DEBUG=true)
  |
  v
Login to CourtReserve (email/password, retry up to 2x with backoff)
  |
  v
Navigate to availability grid, set date via Kendo Scheduler API
  |
  v
Extract all 252 reserve buttons (7 courts x 36 slots), filter by requested date
  |
  v
Sort candidates: doubles courts first, then by court ID ascending
  |
  v
[If advance booking: tight spin-wait for exact window open (200ms poll)]
  |
  v
Try each candidate court in order:
  Click hidden reserve button -> Fill booking modal -> Save
  If rejected, try next court
  |
  v
Notify result to console (success/unavailable/error + alternatives)
  |
  v
[If --calendar and success: create Google Calendar event via API]
  |
  v
[If success: process payment (auto or manual depending on DEBUG/--pay)]
  |
  v
Close browser
```

## Module Details

### Entry Point (`index.ts`)

Orchestrates the full pipeline. Registers SIGINT/SIGTERM handlers for graceful browser cleanup. Phases:
1. Load config, prompt for slot
2. Wait for booking window if advance booking
3. Launch browser, login, get available slots
4. Filter and sort candidates by court preference
5. Try each court until one succeeds
6. Notify result, process payment

### Configuration (`config.ts`)

Validates env vars via Zod schema. Required: `COURTRESERVE_USERNAME`, `COURTRESERVE_PASSWORD`. Optional: `DEBUG`. Returns a frozen `Config` object. The CourtReserve base URL is hardcoded as a constant.

### Types (`types.ts`)

Core domain types, all with `readonly` fields:
- `Court` -- id, name, isDoubles
- `SlotRequest` -- date (YYYY-MM-DD), startTime (HH:MM 24h), durationMinutes
- `TimeSlot` -- court + startTime + endTime + date + isAvailable
- `BookingResult` -- status (success|already_booked|unavailable|error), message, slot?, alternatives?
- `BookingStatus` -- union of the four status strings
- `DayOfWeek` -- lowercase day names

### CLI Parsing (`prompts.ts`)

Three input modes:
1. **Natural language**: `--command "Book Thursday at 11pm"` -- delegates to `nl-parser.ts`
2. **Explicit flags**: `--date`, `--time`, `--duration` -- validates and returns without prompting
3. **Interactive**: readline prompts for missing fields with defaults and validation

Validators enforce: date format (YYYY-MM-DD, not in past), time range (06:00-24:00), duration (30/60/90/120 min, must not exceed closing).

Exports `computeEndTime()` used by `index.ts` for slot endTime calculation.

### Natural Language Parser (`nl-parser.ts`)

Sends user command to Claude Haiku with today's date context. Extracts structured `{date, startTime, durationMinutes}` from free-text. Defaults duration to 60 if unspecified. JSON response parsed with regex fallback.

### Notification (`notifier.ts`)

Console output with ANSI colors. Four cases: green checkmark (success), yellow warning (already booked), red X (unavailable + up to 3 alternatives), red X (error). Pure console output, no side effects.

### Retry (`retry.ts`)

Generic `withRetry<T>()` wrapper. Exponential backoff with jitter. Configurable: maxRetries, baseDelayMs, maxDelayMs, shouldRetry predicate. Used for login attempts.

### Booking Window (`booking-window.ts`)

CourtReserve opens slots exactly 7 days in advance. This module:
- Calculates when a slot becomes bookable
- `waitForBookingWindow()` -- countdown with decreasing update intervals (30s -> 10s -> 1s)
- `waitForExactWindowOpen()` -- tight 200ms poll for precision timing after browser is ready

### Court Selector (`court-selector.ts`)

Sorts available slots by preference: doubles courts first, then lowest court ID. Returns the best match or null.

### Slot Suggester (`slot-suggester.ts`)

When the requested slot is unavailable, suggests up to 3 alternatives sorted by time proximity to the request, with doubles preference as tiebreaker.

### Time Utilities (`time-utils.ts`)

Two functions: `timeToMinutes("HH:MM") -> number` and `minutesToTime(number) -> "HH:MM"`. Used across validation, suggestion, and computation.

### Google Calendar (`calendar.ts`)

Optional integration that creates a Google Calendar event after a successful booking. Uses the `googleapis` package (not browser automation) for reliability.

Three exports:
- `authorizeGoogle()` -- One-time interactive OAuth flow. Starts a local HTTP server for the callback, opens the user's browser for consent, saves refresh token to `.google-tokens.json`.
- `createCalendarEvent(slot, durationMinutes)` -- Finds the "NYC TENNIS" calendar by name, creates an event with court name, date/time, and location. Returns the event HTML link.
- `hasGoogleAuth()` -- Checks if saved tokens exist. Used by `index.ts` to provide a helpful error message.

Activated by `--calendar` CLI flag or natural language intent detection ("add to calendar"). Dynamically imported in `index.ts` so `googleapis` is only loaded when needed. Graceful degradation: calendar failure logs a warning but doesn't fail the booking.

## Browser Module (`src/browser/`)

### Client (`client.ts`)

Launches Chromium via Playwright. Headless by default, headed when `config.debug` is true. Viewport 1280x720. Timeouts: 30s navigation, 10s actions. Returns `{browser, page}` session object.

### Auth (`auth.ts`)

Derives login URL from base URL. Fills email/password, clicks Continue, waits for networkidle. Validates login by checking URL changed away from `/Account/Login`. Debug logging of post-login state. Retry-compatible (throws on failure).

### Selectors (`selectors.ts`)

Constants grouped by page: `LOGIN`, `GRID`, `MODAL`, `MY_RESERVATIONS`, `PAYMENT`. Each is a frozen object with CSS/Playwright selector strings. Multiple fallback selectors separated by commas for resilience.

### Availability (`availability.ts`)

Navigates to the grid page, sets date via Kendo Scheduler jQuery API (`scheduler.date(new Date(...))`). Extracts all `button[data-testid='reserveBtn']` elements (252 total), parses court label and time from attributes. `clickReserveButton()` finds the matching button and clicks via `evaluate()` because buttons have `class="hide"` (display:none).

### Booking (`booking.ts`)

Handles the booking modal:
1. Waits for disclosure checkbox (modal detection)
2. Sets duration via Kendo DropDownList API -- opens dropdown, matches option text, clicks. Fallback: sets value directly via API
3. Checks disclosure checkbox via JS (scrollIntoView + checked + dispatchEvent)
4. Clicks Save, waits 3s for server response
5. Checks for "Reservation Notice" error popup -- dismisses and returns error status
6. Returns success/error BookingResult

### Payment (`payment.ts`)

Navigates to payment URL. Checks if payment needed. Extracts TOTAL DUE via regex. Finds Pay button (avoiding nav links), scrolls and clicks. Checks for success indicators. Handles multi-step confirmation flows. Screenshots in debug mode.

### Reservations (`reservations.ts`)

Parses My Reservations page for existing bookings. Extracts court number, times (12h -> 24h conversion), and date from booking cards. Used for idempotency checks.

## Key Design Decisions

### Immutability

All types use `readonly` fields. Config, slot collections, and suggestions are frozen with `Object.freeze()`. No in-place mutation anywhere in the codebase.

### Kendo UI Workarounds

CourtReserve uses Kendo UI which doesn't play well with standard Playwright selectors:
- **Date navigation**: URL `?date=` param is ignored. Must use `scheduler.date()` via jQuery/Kendo API
- **Dropdowns**: Standard `selectOption()` doesn't work. Must open via `kendoDropDownList.open()` then click list items
- **Hidden elements**: Reserve buttons have `class="hide"` (display:none). Must use `el.evaluate(e => e.click())` -- Playwright's `force: true` doesn't work on display:none
- **Stale popups**: Previous dropdown popups persist in DOM. Must remove `.k-animation-container` before opening new ones

### Advance Booking Sniper

Two-phase wait for 7-day advance bookings:
1. **Phase 1**: Sleep with countdown until 30s before window opens (efficient, low CPU)
2. **Phase 2**: After browser is launched and logged in, tight 200ms poll for exact window open (precision)

### Doubles Court Preference

Courts sorted: doubles first, then by ID ascending. Court 1 is singles (avoided if doubles available). Applies to both primary booking and alternative suggestions.

### Graceful Degradation

- Booking failures try next court in preference order
- Payment failure doesn't invalidate the booking
- Error popups are dismissed before retrying
- SIGINT/SIGTERM handlers ensure browser cleanup

### Debug Mode

`DEBUG=true` enables: headed browser, screenshot capture, verbose logging of page state, payment skip (unless `--pay` flag). Screenshots saved to `debug/` directory.
