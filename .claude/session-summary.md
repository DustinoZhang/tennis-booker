# Session Summary - 2026-03-24

## What was done

1. **Google Calendar integration** -- Full feature: OAuth flow, event creation on "NYC TENNIS" calendar, `--calendar` CLI flag, NL intent detection ("add to calendar"). Uses `googleapis` package (not browser automation).
2. **Architecture documentation** -- Created `docs/architecture.md` with full system docs (data flow, module responsibilities, design decisions). Referenced from CLAUDE.md.
3. **Documentation maintenance hook** -- Added CLAUDE.md instructions requiring doc updates (README, CLAUDE.md, architecture.md) after every feature change.
4. **Session continuity** -- Added SessionStart hook in project `.claude/settings.local.json` that reads this file. Added CLAUDE.md instructions to write session summaries.
5. **End-to-end test** -- Booked Court #2 (Doubles) on 2026-03-28 at 22:30, paid $66.00 via account credit (receipt #57RPO10243). Calendar integration tested separately and confirmed working.

## Key decisions

- Google Calendar API over browser automation (Google blocks bots aggressively)
- `--calendar` is opt-in (not default behavior)
- Calendar failure doesn't fail the booking (graceful degradation)
- Dynamic import of `googleapis` so it's only loaded when `--calendar` is used
- Token file path resolved relative to project root (not CWD)
- All hooks/settings are project-level, not global

## Files changed/created

- `src/calendar.ts` (new) -- OAuth + event creation + test mode
- `src/types.ts` -- added `addToCalendar` to SlotRequest
- `src/config.ts` -- added optional Google env vars
- `src/prompts.ts` -- added `--calendar` flag, threaded through all paths
- `src/nl-parser.ts` -- LLM prompt detects calendar intent
- `src/index.ts` -- calendar step after notify, before payment
- `docs/architecture.md` (new) -- full architecture docs
- `CLAUDE.md` -- architecture ref, calendar docs, doc maintenance + session continuity instructions
- `README.md` -- calendar setup guide with GCP troubleshooting
- `.claude/settings.local.json` -- SessionStart hook for session summary
- `package.json` -- googleapis dep, auth:google + calendar:test scripts
- `.env.example` -- Google credential placeholders
- `.gitignore` -- .google-tokens.json excluded

## What's next

- Unit tests for `calendar.ts` (hasGoogleAuth, createCalendarEvent with mocked googleapis)
- Unit tests for `--calendar` flag parsing (true case)
- Config test coverage for Google credential env vars
