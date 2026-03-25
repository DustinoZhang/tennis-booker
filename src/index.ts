import "dotenv/config";
import * as readline from "node:readline/promises";
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
import type { SlotRequest } from "./types.js";
import {
  validateDate,
  validateStartTime,
  validateDuration,
  VALID_DURATIONS,
} from "./prompts.js";
import { parseNaturalLanguage } from "./nl-parser.js";

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

type BookingOutcome = "success" | "unavailable";

async function attemptBooking(
  config: ReturnType<typeof loadConfig>,
  slotRequest: SlotRequest
): Promise<BookingOutcome> {
  const isAdvanceBooking = needsToWait(slotRequest.date, slotRequest.startTime);

  if (isAdvanceBooking) {
    await waitForBookingWindow(slotRequest.date, slotRequest.startTime);
  }

  const { browser, page } = await launchBrowser(config);
  activeBrowser = browser;

  try {
    await withRetry(() => login(page, config), {
      maxRetries: 2,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      shouldRetry: (error) => !error.message.includes("Login failed"),
    });

    const availableSlots = await getAvailableSlots(
      page,
      config.baseUrl,
      slotRequest.date
    );

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
      return "unavailable";
    }

    if (isAdvanceBooking) {
      await waitForExactWindowOpen(slotRequest.date, slotRequest.startTime);
    }

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
      return "unavailable";
    }

    notify(result);

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

    return "success";
  } finally {
    await closeBrowser(browser);
    activeBrowser = null;
  }
}

type RetryAction =
  | { readonly kind: "same" }
  | { readonly kind: "new"; readonly slotRequest: SlotRequest }
  | { readonly kind: "exit" };

async function promptRetry(previous: SlotRequest): Promise<RetryAction> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("\nWhat would you like to do?");
    console.log(
      `  [1] Retry same booking (${previous.date} at ${previous.startTime}, ${previous.durationMinutes}min)`
    );
    console.log("  [2] Try different date/time/duration");
    console.log('  [3] Describe what you want (e.g., "Thursday at 11pm for 1 hour")');
    console.log("  [4] Exit\n");

    const choice = (await rl.question("Choice [1-4]: ")).trim();

    if (choice === "1" || choice === "") {
      return { kind: "same" };
    }

    if (choice === "4") {
      return { kind: "exit" };
    }

    if (choice === "3") {
      const command = (await rl.question("Describe your booking: ")).trim();
      if (!command) return { kind: "same" };

      console.log("Interpreting...");
      const parsed = await parseNaturalLanguage(command);
      console.log(
        `  -> Date: ${parsed.date}, Time: ${parsed.startTime}, Duration: ${parsed.durationMinutes}min`
      );

      const dateResult = validateDate(parsed.date);
      if (dateResult !== true) throw new Error(`${dateResult} (parsed date: ${parsed.date})`);
      const timeResult = validateStartTime(parsed.startTime);
      if (timeResult !== true) throw new Error(`${timeResult} (parsed time: ${parsed.startTime})`);
      const durResult = validateDuration(parsed.durationMinutes, parsed.startTime);
      if (durResult !== true) throw new Error(`${durResult} (parsed duration: ${parsed.durationMinutes})`);

      return {
        kind: "new",
        slotRequest: Object.freeze({
          ...parsed,
          addToCalendar: previous.addToCalendar ?? false,
        }),
      };
    }

    // choice === "2" or fallthrough: prompt for explicit params
    const today = new Date().toISOString().split("T")[0]!;

    const date = await askWithValidation(rl, `Date [${today}]: `, (v) => {
      const val = v || today;
      const result = validateDate(val);
      return result === true ? val : null;
    });

    const startTime = await askWithValidation(rl, "Start time (HH:MM): ", (v) => {
      const result = validateStartTime(v);
      return result === true ? v : null;
    });

    const validDurations = VALID_DURATIONS.filter(
      (d) => validateDuration(d, startTime) === true
    );
    console.log(`  Available: ${validDurations.map((d) => `${d}min`).join(", ")}`);

    const durationMinutes = await askWithValidation(
      rl,
      "Duration (minutes): ",
      (v) => {
        const num = parseInt(v, 10);
        const result = validateDuration(num, startTime);
        return result === true ? num : null;
      }
    );

    return {
      kind: "new",
      slotRequest: Object.freeze({
        date,
        startTime,
        durationMinutes,
        addToCalendar: previous.addToCalendar ?? false,
      }),
    };
  } finally {
    rl.close();
  }
}

async function promptBookAnother(previous: SlotRequest): Promise<RetryAction> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("\nWould you like to book another court?");
    console.log("  [1] Yes, same slot");
    console.log("  [2] Yes, different date/time/duration");
    console.log('  [3] Yes, describe it (e.g., "Thursday at 11pm for 1 hour")');
    console.log("  [4] No, exit\n");

    const choice = (await rl.question("Choice [1-4]: ")).trim();

    if (choice === "4" || choice === "") {
      return { kind: "exit" };
    }

    if (choice === "1") {
      return { kind: "same" };
    }

    if (choice === "3") {
      const command = (await rl.question("Describe your booking: ")).trim();
      if (!command) return { kind: "same" };

      console.log("Interpreting...");
      const parsed = await parseNaturalLanguage(command);
      console.log(
        `  -> Date: ${parsed.date}, Time: ${parsed.startTime}, Duration: ${parsed.durationMinutes}min`
      );

      const dateResult = validateDate(parsed.date);
      if (dateResult !== true) throw new Error(`${dateResult} (parsed date: ${parsed.date})`);
      const timeResult = validateStartTime(parsed.startTime);
      if (timeResult !== true) throw new Error(`${timeResult} (parsed time: ${parsed.startTime})`);
      const durResult = validateDuration(parsed.durationMinutes, parsed.startTime);
      if (durResult !== true) throw new Error(`${durResult} (parsed duration: ${parsed.durationMinutes})`);

      return {
        kind: "new",
        slotRequest: Object.freeze({
          ...parsed,
          addToCalendar: previous.addToCalendar ?? false,
        }),
      };
    }

    // choice === "2" or fallthrough: prompt for explicit params
    const today = new Date().toISOString().split("T")[0]!;

    const date = await askWithValidation(rl, `Date [${today}]: `, (v) => {
      const val = v || today;
      const result = validateDate(val);
      return result === true ? val : null;
    });

    const startTime = await askWithValidation(rl, "Start time (HH:MM): ", (v) => {
      const result = validateStartTime(v);
      return result === true ? v : null;
    });

    const validDurations = VALID_DURATIONS.filter(
      (d) => validateDuration(d, startTime) === true
    );
    console.log(`  Available: ${validDurations.map((d) => `${d}min`).join(", ")}`);

    const durationMinutes = await askWithValidation(
      rl,
      "Duration (minutes): ",
      (v) => {
        const num = parseInt(v, 10);
        const result = validateDuration(num, startTime);
        return result === true ? num : null;
      }
    );

    return {
      kind: "new",
      slotRequest: Object.freeze({
        date,
        startTime,
        durationMinutes,
        addToCalendar: previous.addToCalendar ?? false,
      }),
    };
  } finally {
    rl.close();
  }
}

async function askWithValidation<T>(
  rl: readline.Interface,
  question: string,
  parse: (input: string) => T | null
): Promise<T> {
  while (true) {
    const answer = (await rl.question(question)).trim();
    const result = parse(answer);
    if (result !== null) return result;
    console.log("  Invalid input, try again.");
  }
}

async function main(): Promise<void> {
  registerShutdownHandlers();

  const config = loadConfig();
  let slotRequest = await promptForSlot();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log(
      `\nBooking ${slotRequest.durationMinutes}min on ${slotRequest.date} at ${slotRequest.startTime}...\n`
    );

    try {
      const outcome = await attemptBooking(config, slotRequest);

      if (outcome === "unavailable") {
        // Slot not available -- offer to try again
        try {
          const action = await promptRetry(slotRequest);
          if (action.kind === "exit") break;
          if (action.kind === "new") slotRequest = action.slotRequest;
          continue;
        } catch {
          break;
        }
      }

      // Success -- offer to book another court
      try {
        const action = await promptBookAnother(slotRequest);
        if (action.kind === "exit") break;
        if (action.kind === "new") slotRequest = action.slotRequest;
        if (action.kind === "same") continue;
      } catch {
        break;
      }

      break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\n\x1b[31m\x1b[1mBooking failed:\x1b[0m ${msg}`);

      try {
        const action = await promptRetry(slotRequest);
        if (action.kind === "exit") break;
        if (action.kind === "new") slotRequest = action.slotRequest;
      } catch {
        break;
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
