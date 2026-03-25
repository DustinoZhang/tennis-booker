import path from "node:path";
import type { Page } from "playwright";
import type { TimeSlot } from "../types.js";
import { captureFailure } from "./diagnostics.js";

const debug = process.env.DEBUG === "true" || process.env.DEBUG === "1";

function parseDateAttr(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeAttr(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseCourtLabel(
  label: string
): { id: string; name: string; isDoubles: boolean } {
  const match = label.match(/Court #(\d+)/);
  const id = match ? match[1]! : "0";
  return {
    id,
    name: label,
    isDoubles: !label.includes("Singles"),
  };
}

async function navigateToDate(page: Page, date: string): Promise<void> {
  await page.evaluate((targetDate) => {
    const jq = (window as unknown as Record<string, unknown>).jQuery ??
      (window as unknown as Record<string, unknown>).$;
    if (typeof jq !== "function") return;
    const $el = (jq as CallableFunction)(".k-scheduler");
    const scheduler = $el.data("kendoScheduler");
    if (scheduler) {
      scheduler.date(new Date(targetDate + "T12:00:00"));
    }
  }, date);
  await page.waitForLoadState("networkidle");
}

export async function getAvailableSlots(
  page: Page,
  baseUrl: string,
  date: string
): Promise<readonly TimeSlot[]> {
  try {
    await page.goto(baseUrl);
  } catch (error) {
    const screenshotPath = await captureFailure(page, "availability-load");
    const hint = screenshotPath
      ? `Check the screenshot at:\n  ${screenshotPath}`
      : "Could not capture screenshot.";
    throw new Error(
      `Failed to load availability page.\n  ${hint}`,
      { cause: error }
    );
  }
  await page.waitForLoadState("networkidle");

  // Navigate to the target date via Kendo scheduler API
  await navigateToDate(page, date);

  if (debug) {
    console.log("[DEBUG] Availability page URL:", page.url());
    const displayedDate = await page
      .locator(".k-lg-date-format")
      .textContent()
      .catch(() => "unknown");
    console.log("[DEBUG] Scheduler showing date:", displayedDate);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const screenshotPath = path.resolve(`debug/grid-${date}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log("[DEBUG] Screenshot saved to:", screenshotPath);
  }

  // Parse all Reserve buttons for the target date.
  // Every 30-min slot has a button (7 courts x 36 slots = 252) regardless
  // of availability. The booking flow tries courts in preference order and
  // lets the server validate actual availability.
  const reserveBtns = await page
    .locator("button[data-testid='reserveBtn']")
    .all();

  if (debug) {
    console.log("[DEBUG] Reserve buttons found:", reserveBtns.length);
  }

  const slots: TimeSlot[] = [];

  for (const btn of reserveBtns) {
    const startAttr = await btn.getAttribute("start");
    const endAttr = await btn.getAttribute("end");
    const courtLabel = await btn.getAttribute("data-courtlabel");

    if (!startAttr || !endAttr || !courtLabel) continue;

    const slotDate = parseDateAttr(startAttr);
    if (slotDate !== date) continue;

    slots.push({
      court: parseCourtLabel(courtLabel),
      startTime: parseTimeAttr(startAttr),
      endTime: parseTimeAttr(endAttr),
      date: slotDate,
      isAvailable: true,
    });
  }

  if (debug) {
    console.log("[DEBUG] Slots for date:", slots.length);
  }

  return Object.freeze(slots);
}

/**
 * Click the Reserve button for a specific court and time on the current page.
 * Assumes the page is already showing the correct date.
 */
export async function clickReserveButton(
  page: Page,
  slot: TimeSlot
): Promise<void> {
  const reserveBtns = await page
    .locator("button[data-testid='reserveBtn']")
    .all();

  for (const btn of reserveBtns) {
    const startAttr = await btn.getAttribute("start");
    const courtLabel = await btn.getAttribute("data-courtlabel");

    if (!startAttr || !courtLabel) continue;

    const time = parseTimeAttr(startAttr);
    const date = parseDateAttr(startAttr);

    if (
      time === slot.startTime &&
      date === slot.date &&
      courtLabel === slot.court.name
    ) {
      // Reserve buttons have class "hide" (display:none) -- use native click()
      // to trigger the handler directly, bypassing Playwright visibility checks
      await btn.evaluate((el) => (el as HTMLElement).click());
      return;
    }
  }

  const screenshotPath = await captureFailure(page, "reserve-button-missing");
  const hint = screenshotPath
    ? `Check the screenshot at:\n  ${screenshotPath}`
    : "";
  throw new Error(
    `Reserve button not found for ${slot.court.name} at ${slot.startTime}.` +
      (hint ? `\n  ${hint}` : "")
  );
}
