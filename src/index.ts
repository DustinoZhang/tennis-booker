import "dotenv/config";
import { loadConfig } from "./config.js";
import { promptForSlot } from "./prompts.js";
import { launchBrowser, closeBrowser } from "./browser/client.js";
import { login } from "./browser/auth.js";

import { getAvailableSlots, clickReserveButton } from "./browser/availability.js";
import { bookSlot } from "./browser/booking.js";

import { suggestAlternatives } from "./slot-suggester.js";
import { notify } from "./notifier.js";
import { withRetry } from "./retry.js";
import { computeEndTime } from "./prompts.js";
import { processPayment } from "./browser/payment.js";
import {
  needsToWait,
  waitForBookingWindow,
  waitForExactWindowOpen,
} from "./booking-window.js";
import type { Browser } from "playwright";

const NAV_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let activeBrowser: Browser | null = null;

function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Closing browser...`);
    if (activeBrowser) {
      await closeBrowser(activeBrowser);
      activeBrowser = null;
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

async function main(): Promise<void> {
  registerShutdownHandlers();

  const config = loadConfig();
  const slotRequest = await promptForSlot();

  console.log(
    `\nBooking ${slotRequest.durationMinutes}min on ${slotRequest.date} at ${slotRequest.startTime}...\n`
  );

  const isAdvanceBooking = needsToWait(slotRequest.date, slotRequest.startTime);

  // Phase 1: If the booking window hasn't opened, sleep until 30s before it does
  if (isAdvanceBooking) {
    await waitForBookingWindow(slotRequest.date, slotRequest.startTime);
  }

  // Phase 2: Launch browser, login, navigate to grid
  const { browser, page } = await launchBrowser(config);
  activeBrowser = browser;

  try {
    // 1. Login
    await withRetry(() => login(page, config), {
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      shouldRetry: (error) => !error.message.includes("Login failed"),
    });

    // 2. Get all slots at the requested time
    const availableSlots = await getAvailableSlots(
      page,
      config.baseUrl,
      slotRequest.date
    );

    // 4. Get candidate courts sorted by preference (doubles first, lowest ID)
    const candidates = availableSlots
      .filter(
        (slot) =>
          slot.startTime === slotRequest.startTime &&
          slot.date === slotRequest.date
      )
      .sort((a, b) => {
        if (a.court.isDoubles && !b.court.isDoubles) return -1;
        if (!a.court.isDoubles && b.court.isDoubles) return 1;
        return a.court.id.localeCompare(b.court.id);
      });

    if (candidates.length === 0) {
      const alternatives = suggestAlternatives(availableSlots, slotRequest);
      notify({
        status: "unavailable",
        message: `No court available at ${slotRequest.startTime} on ${slotRequest.date}`,
        alternatives,
      });
      return;
    }

    // Phase 3: If advance booking, wait for the exact window open before clicking
    if (isAdvanceBooking) {
      await waitForExactWindowOpen(slotRequest.date, slotRequest.startTime);
    }

    // 5. Try each court until one succeeds
    let result: import("./types.js").BookingResult | null = null;

    for (const candidate of candidates) {
      const endTime = computeEndTime(
        candidate.startTime,
        slotRequest.durationMinutes
      );
      const fullSlot = { ...candidate, endTime };

      const debug = process.env.DEBUG === "true" || process.env.DEBUG === "1";
      if (debug) {
        console.log(`[DEBUG] Trying ${fullSlot.court.name}...`);
      }

      await clickReserveButton(page, fullSlot);
      result = await bookSlot(page, fullSlot, slotRequest.durationMinutes);

      if (result.status === "success") break;

      // If rejected, wait briefly before trying next court
      if (debug) {
        console.log(`[DEBUG] ${fullSlot.court.name} rejected, trying next...`);
      }
      await sleep(1000);
    }

    if (!result) {
      notify({
        status: "unavailable",
        message: `No court available at ${slotRequest.startTime} on ${slotRequest.date}`,
      });
      return;
    }

    notify(result);

    // 7. Add to Google Calendar if requested
    if (slotRequest.addToCalendar && result.status === "success" && result.slot) {
      console.log("\nAdding to Google Calendar...");
      try {
        const { hasGoogleAuth, createCalendarEvent } = await import("./calendar.js");
        if (!(await hasGoogleAuth())) {
          console.log(
            `\x1b[33m\x1b[1m⚠ Calendar event not created:\x1b[0m ` +
              `Not authorized. Run \`npm run auth:google\` first.\n` +
              `  Your court booking succeeded -- only the calendar entry was skipped.`
          );
        } else {
          const eventUrl = await createCalendarEvent(result.slot, slotRequest.durationMinutes);
          console.log(`\x1b[32m\x1b[1m✓ Calendar event created:\x1b[0m ${eventUrl}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(
          `\x1b[33m\x1b[1m⚠ Calendar event not created:\x1b[0m ${msg}\n` +
            `  Your court booking succeeded -- only the calendar entry was skipped.`
        );
      }
    }

    // 8. Process payment if booking succeeded
    if (result.status === "success") {
      const autoPay = process.argv.includes("--pay");
      const debug = process.env.DEBUG === "true" || process.env.DEBUG === "1";

      if (debug && !autoPay) {
        console.log(
          "\x1b[33m\x1b[1mPayment skipped (DEBUG mode).\x1b[0m " +
            "Use --pay to auto-pay, or pay manually within 15 minutes."
        );
      } else {
        await sleep(NAV_DELAY_MS);
        console.log("Processing payment...");

        const paymentResult = await processPayment(page);

        if (paymentResult.status === "success") {
          console.log(`\x1b[32m\x1b[1mPayment complete:\x1b[0m ${paymentResult.message}`);
        } else {
          console.error(`\x1b[31m\x1b[1mPayment issue:\x1b[0m ${paymentResult.message}`);
          console.log("Please complete payment manually within 15 minutes.");
        }
      }
    }
  } finally {
    await closeBrowser(browser);
    activeBrowser = null;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
