import type { BookingResult, TimeSlot } from "./types.js";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function formatSlot(slot: TimeSlot): string {
  return `${slot.court.name}  |  ${slot.date}  |  ${slot.startTime}–${slot.endTime}`;
}

function formatAlternatives(alternatives: readonly TimeSlot[]): void {
  console.log(`${BOLD}  Alternatives:${RESET}`);
  for (const slot of alternatives) {
    console.log(`    ${YELLOW}•${RESET} ${formatSlot(slot)}`);
  }
}

export function notify(result: BookingResult): void {
  switch (result.status) {
    case "success": {
      const slotLine =
        result.slot !== undefined ? `\n  ${formatSlot(result.slot)}` : "";
      console.log(
        `${GREEN}${BOLD}✓ Booking confirmed${RESET}${GREEN}${slotLine}${RESET}`
      );
      break;
    }

    case "already_booked": {
      console.log(
        `${YELLOW}${BOLD}⚠ Already booked${RESET}${YELLOW}  ${result.message}${RESET}`
      );
      break;
    }

    case "unavailable": {
      console.log(
        `${RED}${BOLD}✗ Unavailable${RESET}${RED}  ${result.message}${RESET}`
      );
      if (result.alternatives !== undefined && result.alternatives.length > 0) {
        formatAlternatives(result.alternatives);
      }
      break;
    }

    case "error": {
      console.log(
        `${RED}${BOLD}✗ Error${RESET}${RED}  ${result.message}${RESET}`
      );
      break;
    }
  }
}
