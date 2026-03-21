import path from "node:path";
import type { Page } from "playwright";

const debug = process.env.DEBUG === "true" || process.env.DEBUG === "1";

const PAYMENT_URL =
  "https://app.courtreserve.com/Online/Payments/ProcessPayment/10243";

type PaymentResult = {
  readonly status: "success" | "error";
  readonly message: string;
};

export async function processPayment(page: Page): Promise<PaymentResult> {
  try {
    // Navigate directly to the payment page
    await page.goto(PAYMENT_URL);
    await page.waitForLoadState("networkidle");

    if (debug) {
      console.log("[DEBUG] Payment page URL:", page.url());
      console.log("[DEBUG] Payment page title:", await page.title());

      const bodyText = await page.locator("body").innerText();
      console.log("[DEBUG] Payment page text (first 500 chars):", bodyText.slice(0, 500));
    }

    // Check if there's nothing to pay
    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("don't have any booked items") || bodyText.includes("No items")) {
      return { status: "success", message: "No payment required" };
    }

    // Extract the total amount
    const totalMatch = bodyText.match(/TOTAL DUE:\s*\$?([\d,.]+)/);
    const amount = totalMatch ? `$${totalMatch[1]}` : "unknown";

    if (debug) console.log("[DEBUG] Total due:", amount);

    // Find the Pay button — avoid the nav "Pay" link by targeting the form button
    // The Pay button is inside the payment form, after the TOTAL DUE section
    const payButton = page.locator(
      "button:has-text('Pay'):near(:text('TOTAL DUE')), " +
      "button.btn:has-text('Pay'):not(nav button), " +
      "input[type='submit'][value*='Pay']"
    ).last();

    if (await payButton.count() === 0) {
      return { status: "error", message: "Could not find Pay button" };
    }

    if (debug) {
      const btnHtml = await payButton.evaluate((el) => el.outerHTML);
      console.log("[DEBUG] Pay button HTML:", btnHtml.slice(0, 200));
    }

    // Scroll to button and click it
    await payButton.scrollIntoViewIfNeeded();
    try {
      await payButton.click({ timeout: 5000 });
    } catch {
      await payButton.evaluate((el) => (el as HTMLElement).click());
    }

    if (debug) console.log("[DEBUG] Pay button clicked, waiting for confirmation...");

    // Wait for page response
    await page.waitForTimeout(3000);

    if (debug) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const screenshotPath = path.resolve(`debug/payment-after-click-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log("[DEBUG] Post-payment screenshot:", screenshotPath);

      const postText = await page.locator("body").innerText();
      console.log("[DEBUG] Post-payment page URL:", page.url());
      console.log("[DEBUG] Post-payment text (first 500 chars):", postText.slice(0, 500));
    }

    // Check for success indicators
    const postBody = await page.locator("body").innerText();
    const success =
      postBody.includes("Payment successful") ||
      postBody.includes("Thank you") ||
      postBody.includes("Paid") ||
      postBody.includes("Receipt") ||
      postBody.includes("don't have any booked items");

    // Check if there's a second confirmation step (e.g. a form submit)
    const confirmButton = page.locator(
      "button:has-text('Confirm'), " +
      "button:has-text('Submit'), " +
      "button:has-text('Process Payment'), " +
      "input[type='submit']"
    ).first();

    if (!success && await confirmButton.count() > 0) {
      if (debug) console.log("[DEBUG] Found confirmation button, clicking...");
      try {
        await confirmButton.click({ timeout: 5000 });
      } catch {
        await confirmButton.evaluate((el) => (el as HTMLElement).click());
      }
      await page.waitForTimeout(3000);

      if (debug) {
        const postConfirmText = await page.locator("body").innerText();
        console.log("[DEBUG] Post-confirm text (first 300 chars):", postConfirmText.slice(0, 300));
      }
    }

    return {
      status: "success",
      message: `Payment of ${amount} submitted`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown payment error";
    return {
      status: "error",
      message: `Payment failed: ${message}`,
    };
  }
}
