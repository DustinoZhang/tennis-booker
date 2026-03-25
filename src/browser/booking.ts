import type { Page } from "playwright";
import type { TimeSlot, BookingResult } from "../types.js";
import { captureFailure } from "./diagnostics.js";

const debug = process.env.DEBUG === "true" || process.env.DEBUG === "1";

async function setDuration(page: Page, durationMinutes: number): Promise<void> {
  // Duration is a Kendo DropDownList — click to open it, then select the right option

  // Close any stale dropdown popups from previous attempts
  await page.evaluate(() => {
    const jq = (window as unknown as Record<string, unknown>).jQuery ??
      (window as unknown as Record<string, unknown>).$;
    if (typeof jq !== "function") return;
    (jq as CallableFunction)(".k-animation-container").remove();
  });

  // Open the Kendo dropdown via its API
  await page.evaluate(() => {
    const jq = (window as unknown as Record<string, unknown>).jQuery ??
      (window as unknown as Record<string, unknown>).$;
    if (typeof jq !== "function") return;
    const ddl = (jq as CallableFunction)("#Duration").data("kendoDropDownList");
    if (ddl) ddl.open();
  });

  // Wait a moment for the dropdown popup to render
  await page.waitForTimeout(500);

  if (debug) {
    // Log what's in the dropdown popup
    const popupText = await page.locator(".k-animation-container .k-list, .k-animation-container .k-popup").first().innerText().catch(() => "no popup found");
    console.log("[DEBUG] Duration dropdown popup text:", popupText);
  }

  // Find and click the right duration option in the popup list
  const hours = durationMinutes / 60;
  let clicked = false;

  // Try matching common duration label formats
  const patterns = [
    `${durationMinutes} min`,
    hours === 1 ? "1 hour" : `${hours} hour`,
    hours === 0.5 ? "30 min" : "",
    hours === 1.5 ? "1.5 hour" : "",
    hours === 2 ? "2 hour" : "",
  ].filter(Boolean);

  const listItems = page.locator(".k-animation-container .k-list-item, .k-animation-container li");
  const count = await listItems.count();

  if (debug) console.log("[DEBUG] Duration list items count:", count);

  for (let i = 0; i < count; i++) {
    const text = (await listItems.nth(i).textContent() ?? "").toLowerCase().trim();
    if (debug && i < 10) console.log(`[DEBUG]   option[${i}]: "${text}"`);

    for (const pattern of patterns) {
      if (text.includes(pattern.toLowerCase())) {
        await listItems.nth(i).click();
        clicked = true;
        if (debug) console.log("[DEBUG] Selected duration:", text);
        break;
      }
    }
    if (clicked) break;
  }

  if (!clicked) {
    // Fallback: set value via Kendo API directly
    if (debug) console.log("[DEBUG] Fallback: setting duration via Kendo API");
    await page.evaluate((targetMinutes) => {
      const jq = (window as unknown as Record<string, unknown>).jQuery ??
        (window as unknown as Record<string, unknown>).$;
      if (typeof jq !== "function") return;
      const ddl = (jq as CallableFunction)("#Duration").data("kendoDropDownList");
      if (!ddl) return;
      // Try setting by value (could be minutes as string)
      ddl.value(String(targetMinutes));
      ddl.trigger("change");
    }, durationMinutes);
  }
}

export async function bookSlot(
  page: Page,
  slot: TimeSlot,
  durationMinutes: number
): Promise<BookingResult> {
  try {
    // Wait for booking modal — the disclosure checkbox is unique to it
    const checkbox = page.locator("[data-testid='DisclosureAgree']");
    await checkbox.waitFor({ state: "attached", timeout: 15_000 });

    if (debug) console.log("[DEBUG] Booking modal detected");

    // Set duration via Kendo DropDownList API
    await setDuration(page, durationMinutes);

    // Check disclosure checkbox via JS (it's often below the viewport in the modal)
    await checkbox.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      (el as HTMLInputElement).checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (debug) console.log("[DEBUG] Disclosure checkbox checked");

    // Click Save button
    await page.locator("button:has-text('Save')").first().click();

    if (debug) console.log("[DEBUG] Save clicked, waiting for response...");

    // Wait for page to process
    await page.waitForTimeout(3000);

    // Check for error popup ("Reservation Notice")
    const errorPopup = page.locator("text='Reservation Notice'");
    if (await errorPopup.count() > 0) {
      const errorText = await errorPopup.locator("xpath=..").innerText().catch(() => "");
      // Dismiss the error popup
      await page.locator("button:has-text('OK')").first().click().catch(() => {});
      await page.waitForTimeout(500);
      // Close the booking modal so the next attempt starts fresh
      await page.locator("button:has-text('Close')").first().click().catch(() => {});
      await page.waitForTimeout(500);
      return {
        status: "error",
        message: `Booking rejected: ${errorText.replace("Reservation Notice", "").trim()}`,
        slot,
      };
    }

    await page.waitForLoadState("networkidle");

    return {
      status: "success",
      message: `Booked ${slot.court.name} on ${slot.date} at ${slot.startTime}`,
      slot,
    };
  } catch (error) {
    const screenshotPath = await captureFailure(page, "booking-failure");
    const message =
      error instanceof Error ? error.message : "Unknown booking error";
    const hint = screenshotPath
      ? `\n  Screenshot: ${screenshotPath}`
      : "";
    return {
      status: "error",
      message: `Booking failed: ${message}${hint}`,
      slot,
    };
  }
}
