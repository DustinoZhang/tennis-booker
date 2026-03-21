# Tennis Booker

CLI tool that automates booking tennis courts on [CourtReserve](https://app.courtreserve.com). Point it at a date, time, and duration and it handles login, court selection, booking, and payment through browser automation.

Built for McCarren Tennis Center (org 10243), but the patterns apply to any CourtReserve site.

## What it does

1. Logs into CourtReserve with your credentials
2. Navigates to the requested date on the scheduler
3. Picks the best available court (doubles preferred, lowest court number)
4. Opens the booking modal, sets duration, accepts disclosure, saves
5. Processes payment with your card on file
6. If the requested court is taken, automatically tries the next court

## Booking modes

### Immediate booking

For slots within the next 7 days (CourtReserve's booking window), the tool books immediately:

```bash
npm run book -- --date 2026-03-26 --time 23:00 --duration 60
```

### Advance booking (sniper mode)

CourtReserve only allows booking up to 7 days in advance. Courts are competitive -- popular slots fill within seconds of opening.

If you request a slot more than 7 days out, the tool automatically:

1. Calculates when the booking window opens (exactly 7 days before the slot)
2. Sleeps with a live countdown until 30 seconds before the window opens
3. Launches the browser, logs in, and navigates to the grid during those 30 seconds
4. Waits for the exact moment the window opens
5. Clicks Reserve immediately to grab the court first

```bash
npm run book -- --date 2026-04-02 --time 19:00 --duration 60
# Booking window for 2026-04-02 19:00 opens at: 3/26/2026, 7:00:00 PM
# Waiting until 30s before window opens (5d 22h 14m 30s from now)...
```

Leave it running in a terminal. It will fire automatically when the window opens.

### Natural language

Instead of explicit flags, describe what you want in plain English. Requires an Anthropic API key.

```bash
npm run book -- --command "Book me a court this Thursday at 11pm for 1 hour"
# Interpreting command...
#   -> Date: 2026-03-26, Time: 23:00, Duration: 60min
```

### Interactive

Run without arguments to get prompted for each field:

```bash
npm run book
# Date (YYYY-MM-DD) [2026-03-20]:
# Start time (HH:MM, 24-hour):
# Duration (minutes):
```

## Setup

### Prerequisites

- Node.js 18+
- A CourtReserve account with a credit card on file

### Install

```bash
git clone <repo-url>
cd tennis-booker
npm install
```

`npm install` automatically installs Chromium for Playwright via the `postinstall` script.

### Configure

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
COURTRESERVE_USERNAME=your-email@example.com
COURTRESERVE_PASSWORD=your-password
ANTHROPIC_API_KEY=sk-ant-...   # optional, only needed for --command
DEBUG=false
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `COURTRESERVE_USERNAME` | Yes | Your CourtReserve login email |
| `COURTRESERVE_PASSWORD` | Yes | Your CourtReserve password |
| `ANTHROPIC_API_KEY` | No | Enables `--command` natural language input (uses Claude Haiku) |
| `DEBUG` | No | Set to `true` to run browser in headed mode and enable debug logging |

### Verify setup

```bash
DEBUG=true npm run book -- --date <a-date-within-7-days> --time 23:00 --duration 30
```

This opens a visible browser so you can watch the flow. In debug mode, payment is skipped -- you'll see the booking confirmed but won't be charged.

## Usage

### CLI flags

| Flag | Short | Description |
|------|-------|-------------|
| `--date YYYY-MM-DD` | `-d` | Target date |
| `--time HH:MM` | `-t` | Start time (24-hour) |
| `--duration 30\|60` | `-n` | Duration in minutes |
| `--command "..."` | `-c` | Natural language booking request |
| `--pay` | | Force payment even in DEBUG mode |

### Examples

```bash
# Book a court for tonight at 10:30pm, 1 hour
npm run book -- -d 2026-03-20 -t 22:30 -n 60

# Book with natural language
npm run book -- -c "Book me a court next Friday at 7pm for an hour"

# Snipe a competitive slot opening in 6 days
npm run book -- -d 2026-03-27 -t 19:00 -n 60

# Debug mode: see browser, skip payment
DEBUG=true npm run book -- -d 2026-03-26 -t 23:00 -n 60

# Debug mode but still pay
DEBUG=true npm run book -- -d 2026-03-26 -t 23:00 -n 60 --pay
```

### Court selection

The tool prefers doubles courts over singles (Court 1 is the singles court). Among doubles courts, it picks the lowest-numbered court. If a court is taken, it tries the next one automatically.

## Developer guide

### Project structure

```
src/
  index.ts              # Entry point and main flow
  booking-window.ts     # Advance booking wait/countdown logic
  config.ts             # Environment variable loading
  prompts.ts            # Interactive + CLI arg parsing
  nl-parser.ts          # Natural language parsing via Claude API
  notifier.ts           # Success/failure notifications
  court-selector.ts     # Court preference logic
  slot-suggester.ts     # Alternative slot suggestions
  retry.ts              # Retry with backoff
  types.ts              # Shared type definitions
  time-utils.ts         # Time conversion utilities
  browser/
    client.ts           # Browser launch/close
    auth.ts             # Login flow
    selectors.ts        # CSS/Playwright selectors
    availability.ts     # Grid parsing + Reserve button clicking
    booking.ts          # Modal interaction (duration, disclosure, save)
    payment.ts          # Payment page processing
    reservations.ts     # My Reservations page parsing
tests/
  unit/                 # Unit tests (vitest)
```

### Running tests

```bash
npm test                    # run all tests
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report
npx vitest run tests/unit/booking-window.test.ts  # single file
```

A pre-commit hook runs `npm test` automatically before every commit.

### Debug mode

Set `DEBUG=true` to enable:

- **Headed browser** -- watch every click in a visible Chromium window
- **Debug logging** -- `[DEBUG]` prefixed lines showing each step (login URL, scheduler date, slots found, duration selection, payment details)
- **Screenshots** -- saved to `debug/` directory (grid view, post-payment state)
- **Payment skipped** -- booking goes through but payment is not submitted unless `--pay` is also passed

```bash
DEBUG=true npm run book -- --date 2026-03-26 --time 23:00 --duration 60
```

