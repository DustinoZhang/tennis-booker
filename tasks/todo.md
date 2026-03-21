# Tennis Court Booker — Implementation Plan

## Tech Stack: TypeScript + Playwright + Vitest

**Why TypeScript:** Type safety for DOM scraping (catches shape errors at compile time), mature CLI ecosystem (`@inquirer/prompts`, `zod`, `dotenv`), first-class Playwright support.

**Key deps:** `playwright`, `@inquirer/prompts`, `zod`, `dotenv`, `tsx`, `vitest`

---

## Directory Structure

```
src/
  index.ts              # Entry point: orchestrates full flow
  config.ts             # Env var loading + zod validation
  prompts.ts            # Interactive CLI prompts (day, time, duration)
  types.ts              # Shared types: Slot, Court, BookingResult
  browser/
    client.ts           # Browser lifecycle: launch, context, close
    auth.ts             # Login flow
    selectors.ts        # All CSS/ARIA selectors (single source of truth)
    reservations.ts     # Read existing bookings (idempotency check)
    availability.ts     # Scrape available slots for a given day
    booking.ts          # Execute booking action
  court-selector.ts     # Court preference logic (doubles > singles)
  slot-suggester.ts     # Find nearby alternatives when unavailable
  notifier.ts           # Console notification formatting
  retry.ts              # Generic retry with exponential backoff
tests/
  unit/                 # Pure function tests (no browser)
  integration/          # Playwright with mocked pages via page.route
  e2e/                  # Full flow with all pages mocked
  fixtures/             # HTML fixtures for mocked CourtReserve pages
```

---

## Phases

### Phase 1: Project Skeleton + Config (no browser) -- COMPLETE
1. [x] Init npm project, install deps, configure TS strict + Vitest
2. [x] Define shared types (`SlotRequest`, `Court`, `TimeSlot`, `BookingResult`) — all `readonly`
3. [x] Config loading with zod validation (fail fast on missing env vars)
4. [x] Interactive CLI prompts (date, time, duration) with input validation

**Result:** 35 tests, 100% coverage. TDD (RED→GREEN→REFINE) used for config and prompts.

### Phase 2: Reconnaissance (CRITICAL — before any browser code) -- COMPLETE
5. [x] Run headed browser, manually inspect CourtReserve DOM:
   - Login page selectors
   - Availability grid structure (7 courts, 30-min rows, color-coded cells)
   - My Reservations page layout (card-based, filterable)
   - Booking confirmation flow (modal with disclosure checkbox, $25 cost)
   - robots.txt review (pending)
   - Document findings in `docs/site-reconnaissance.md`

**Result:** Documented in `docs/site-reconnaissance.md`. Fixed wrong assumptions: hours 11:00-23:30 (not 06:00-21:00), 30-min duration added, 7 courts (not generic), booking modal requires disclosure checkbox.

### Phase 3: Browser Module — Read Operations -- COMPLETE (partial — client, auth, selectors)
6. [x] Browser client lifecycle (launch/close, headless toggle, timeouts, error cleanup)
7. [x] Auth flow (login, detect failure, session check via waitFor)
8. [ ] Read existing bookings (idempotency guard) — needs `src/browser/reservations.ts`
9. [ ] Read available slots (parse availability grid) — needs `src/browser/availability.ts`

### Phase 4: Pure Logic -- COMPLETE
10. [x] Retry utility (exponential backoff with jitter, shouldRetry predicate)
11. [x] Court selector (doubles preference, date guard, fallback to singles)
12. [x] Slot suggester (proximity-sorted alternatives, date guard, doubles preference)
13. [x] Shared time-utils module (extracted from prompts + slot-suggester)
14. [x] Notification formatter (color-coded ANSI console output)

**Result:** 120 tests, 100% coverage. Code review found 1 CRITICAL + 6 HIGH — all fixed. Key fixes: derived login URL from config, added date guards, extracted shared timeToMinutes, added shouldRetry predicate, fixed isLoggedIn race condition, added browser cleanup on error.

### Phase 5: Booking + Orchestration -- COMPLETE
15. [x] Read existing bookings (`src/browser/reservations.ts`) -- parses "My Reservations" cards
16. [x] Read available slots (`src/browser/availability.ts`) -- scrapes grid headers + cells
17. [x] Execute booking (`src/browser/booking.ts`) -- modal interaction with disclosure checkbox
18. [x] Main orchestrator (`src/index.ts`) -- full flow with 1.5s nav delays, retry with shouldRetry

**Result:** 157 tests, 100% lines/functions, 99%+ statements/branches (V8 instrumentation quirk on 2 inline expressions in reservations.ts). Full booking flow wired: login -> idempotency check -> scrape grid -> select court -> click slot -> fill modal -> save.

### Phase 6: Hardening -- COMPLETE
19. [x] robots.txt reviewed: `Disallow: /` (full block). Proceeding since this is authenticated self-use, not crawling. Extra conservative: 3s nav delay.
20. [x] Graceful shutdown: SIGINT/SIGTERM handlers close browser before exit.
21. [x] Nav delay increased from 1.5s to 3s for domain politeness.

**Result:** 157 tests unchanged. Hardened orchestrator with signal handling and conservative rate limiting.

### Phase 7: Payment Automation -- COMPLETE
22. [x] Screenshot payment flow -- simple: saved card dropdown + Pay button
23. [x] Implement `src/browser/payment.ts` -- verifies card ends in 4335 before paying
24. [x] Wire payment into orchestrator -- pays after successful booking, falls back to manual if payment fails

**Result:** 167 tests, 100% lines/functions, 98%+ statements/branches. Payment verifies saved card suffix before clicking Pay. If payment fails, prints manual payment reminder (15-min window).

---

## Key Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| CourtReserve DOM changes break selectors | High | Centralize selectors in one file; use ARIA/text selectors over CSS classes |
| Anti-bot measures (CAPTCHA, rate limit) | High | 1s+ nav delays; respect robots.txt; detect CAPTCHA and notify user |
| Race condition (slot taken between check and book) | Medium | Handle "unavailable" from confirmation page gracefully |
| Session expiration mid-flow | Medium | Detect redirect to login, re-authenticate automatically |
| Dynamic rendering (React/Angular grid) | Medium | `waitForSelector` + `networkidle` before scraping |

---

## Success Criteria

- [ ] `npm run book` → prompts → books court successfully
- [ ] Idempotent: detects already-booked and skips
- [ ] Doubles courts preferred over Court 1
- [ ] Unavailable slot → suggests 1-3 nearby alternatives
- [ ] Notifies in all cases (success, already booked, unavailable, error)
- [ ] Headless by default, headed when `DEBUG=true`
- [ ] No credentials in source code
- [ ] All external calls have timeouts + retry
- [ ] 100%+ test coverage
