---
name: debug-booking
description: Run the booking flow with DEBUG=true, capture output at each step, and iterate until payment stage. Stops before submitting payment for human verification.
user_invocable: true
---

# Debug Booking Flow

Run the tennis booker end-to-end with DEBUG=true, capture and analyze output at each step, and iterate on failures. Stops before actual payment submission.

## CRITICAL: Single Court Only

NEVER book more than one court per debug run unless the user explicitly asks for it. If a booking succeeds and you need to re-test the flow:
1. Go to the CourtReserve cart and cancel the reservation first
2. Or ask the user for permission before booking another court
3. Each test run = at most 1 booking

This is a real booking system with real charges. Treat every booking as a production action.

## Workflow

1. **Run the booker** with `DEBUG=true` and the user's desired parameters:
   ```bash
   DEBUG=true npm run book -- --date <DATE> --time <TIME> --duration <DURATION>
   ```
   Or with natural language:
   ```bash
   DEBUG=true npm run book -- --command "<COMMAND>"
   ```

2. **Analyze the output** at each checkpoint:
   - Login: Check `[DEBUG] Post-login URL` -- should NOT contain `/Account/Login`
   - Navigation: Check `[DEBUG] Scheduler showing date` -- should match requested date
   - Availability: Check `[DEBUG] Slots for date` -- should be > 0
   - Modal: Check `[DEBUG] Booking modal detected` -- modal opened
   - Duration: Check `[DEBUG] Selected duration` -- matches requested duration
   - Save: Check for `Booking confirmed` or `Booking rejected` with reason

3. **If a step fails**, diagnose the root cause:
   - Read the debug screenshots in `debug/` (grid and payment screenshots)
   - Check the error message and call log
   - Fix the relevant source file (selectors, availability, booking)
   - Re-run and verify

4. **Stop before payment**: When `Booking confirmed` appears, verify with the user before proceeding to payment. Show:
   - Court booked
   - Date and time
   - Expected cost
   - Ask: "Booking confirmed. Should I proceed to payment?"

5. **Clean up** debug artifacts after the session:
   ```bash
   rm -rf debug/*.png
   ```

## Checkpoints

| Step | Success Signal | Failure Signal |
|------|---------------|----------------|
| Login | `Post-login URL` is not `/Account/Login` | `Login failed` error |
| Date nav | `Scheduler showing date` matches target | Wrong date displayed |
| Availability | `Slots for date` > 0 | 0 slots found |
| Court selection | Preferred court selected (doubles, lowest #) | `No court available` |
| Modal | `Booking modal detected` | Timeout waiting for modal |
| Duration | `Selected duration` matches | Empty dropdown or wrong selection |
| Save | `Booking confirmed` | `Booking rejected` with reason |
| Payment | `Payment of $X submitted` + receipt URL | Pay button not found or page error |

## Usage Examples

```
/debug-booking --date 2026-03-26 --time 23:00 --duration 60
/debug-booking --command "Book me a court this Thursday at 11pm for 1 hour"
/debug-booking  (will prompt for parameters)
```
