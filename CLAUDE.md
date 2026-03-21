# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Automate booking tennis courts on CourtReserve given a desired slot (day, time, length). The CLI prompts the user for slot preferences and notifies on success/failure.

**Target site:** `https://app.courtreserve.com/Online/Reservations/Index/10243`

## Project Status

Node.js + TypeScript + Playwright. Core booking flow implemented. Tech stack chosen.

## Architecture

Two core components:
1. **Main program** — control flow, user prompts, session management, notifications
2. **Browser module** — page access, form interaction, booking execution

### Key Behavioral Constraints

- Credentials from environment variables only (never hardcoded)
- Respect `robots.txt`; be conservative on polling frequency (IP ban risk)
- Headless in production, headed locally for debugging (`DEBUG=true` or similar env flag)
- **Idempotent**: check if slot is already booked before attempting to book
- All external calls must have explicit timeouts and retry limits with backoff

### Booking Logic Priority

1. Check existing bookings first (idempotency guard)
2. Prefer doubles courts over singles (Court 1 is singles, avoid if doubles available)
3. If requested slot unavailable, suggest nearby available slots in the failure notification
4. Always notify regardless of outcome (success or failure)

## Developer Organization (Claude-specific)

This repo uses the following structure for Claude Code meta-files:
- `skills/` — workflow definitions and domain knowledge
- `commands/` — slash commands (`/tdd`, `/plan`, `/e2e`, etc.)
- `hooks/` — trigger-based automations (pre/post-tool hooks)
- `rules/` — always-follow guidelines (security, coding style, testing)
- `tests/` — test suite

## Commands

```bash
npm install          # install dependencies
npm run book         # run the booker (prompts for slot interactively)
npm run book -- --date <YYYY-MM-DD> --time <HH:MM> --duration <30|60>  # explicit args
npm run book -- --command "Book me a court this Thursday at 11pm for 1 hour"  # natural language (needs ANTHROPIC_API_KEY)
npm test             # run all tests
npm test -- --grep "booking"  # run a single test by name
DEBUG=true npm run book -- ...  # run with headed browser for debugging
```

For testing, pick a weeknight within 5 days at 22:30 or 23:00 -- those slots are reliably open.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `COURTRESERVE_USERNAME` | Login email |
| `COURTRESERVE_PASSWORD` | Login password |
| `ANTHROPIC_API_KEY` | Required for `--command` natural language parsing |
| `DEBUG` | Set to `true`/`1` to run browser in headed mode |

## Verification

Ordered verification steps before marking any change complete:

1. **Unit tests**: `npm test` -- must pass with 80%+ coverage
2. **Type check**: `npx tsc --noEmit` -- must compile cleanly
3. **Debug booking flow**: Use `/debug-booking` skill to run the full booking flow with `DEBUG=true`, verify each checkpoint (login, date nav, availability, modal, duration, save), and stop before payment for human confirmation. See `skills/debug-booking.md` for details.

### CourtReserve DOM Notes

The site uses Kendo UI widgets. Key patterns for browser automation:
- **Kendo DropDownLists** (duration, etc.): Use `.data("kendoDropDownList").open()` then click list items -- NOT `selectOption()`
- **Kendo Scheduler**: Use `.data("kendoScheduler").date(new Date(...))` for date navigation -- URL `?date=` param is ignored
- **Reserve buttons**: ALL 252 exist in DOM (7 courts x 36 slots) with class `hide` -- filter using scheduler event data to find truly available slots
- **Hidden elements**: Use `el.evaluate(e => e.click())` or `dispatchEvent("click")` -- Playwright's `force: true` does not work on `display: none`
