# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Automate booking tennis courts on CourtReserve given a desired slot (day, time, length). The CLI prompts the user for slot preferences and notifies on success/failure.

**Target site:** `https://app.courtreserve.com/Online/Reservations/Index/10243`

## Project Status

Node.js + TypeScript + Playwright. Core booking flow implemented. Tech stack chosen.

## Architecture

> See [`docs/architecture.md`](docs/architecture.md) for detailed module-level documentation, data flow diagrams, and design decisions.

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

## Commands

```bash
npm install          # install dependencies
npm run book         # run the booker (prompts for slot interactively)
npm run book -- --date <YYYY-MM-DD> --time <HH:MM> --duration <30|60>  # explicit args
npm run book -- --command "Book me a court this Thursday at 11pm for 1 hour"  # natural language (needs ANTHROPIC_API_KEY)
npm run book -- --date 2026-03-26 --time 23:00 --duration 60 --calendar  # book + add to Google Calendar
npm run auth:google  # one-time Google Calendar OAuth setup
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
| `GOOGLE_CLIENT_ID` | OAuth client ID for Google Calendar (optional, for `--calendar`) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret for Google Calendar (optional, for `--calendar`) |

## Documentation Maintenance

After completing any feature implementation, bug fix, or architectural change, update all three documentation files to reflect the changes:

1. **`README.md`** -- user-facing docs: CLI flags, setup instructions, examples, project structure
2. **`CLAUDE.md`** -- developer context: commands, env vars, architecture notes, verification steps
3. **`docs/architecture.md`** -- module-level details: data flow, module responsibilities, design decisions

This is not optional. Documentation drift causes wasted time in future sessions. Update docs before committing.

## Session Continuity

Write a compact summary to `.claude/session-summary.md` ONLY when: (1) the user explicitly asks to wrap up, or (2) Claude is forced to shut down (context limit, SIGTERM, etc.). Never write it automatically mid-session. The summary should cover:

1. **What was done** -- features added, bugs fixed, refactors completed
2. **What's in progress** -- unfinished work, known issues, next steps
3. **Key decisions made** -- architectural choices, trade-offs, things the user approved
4. **Files changed** -- list of modified/created files for quick orientation

This file is read automatically at the start of the next session via a SessionStart hook. Keep it under 50 lines. Overwrite (don't append) each session.

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
