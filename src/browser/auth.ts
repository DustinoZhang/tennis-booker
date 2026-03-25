import type { Page } from "playwright";
import type { Config } from "../config.js";
import { LOGIN, MY_RESERVATIONS } from "./selectors.js";
import { captureFailure } from "./diagnostics.js";

function deriveLoginUrl(baseUrl: string): string {
  return baseUrl.replace("/Reservations/Index/", "/Account/Login/");
}

export async function login(page: Page, config: Config): Promise<void> {
  const loginUrl = deriveLoginUrl(config.baseUrl);
  await page.goto(loginUrl);

  try {
    await page.locator(LOGIN.EMAIL_INPUT).fill(config.username);
  } catch (error) {
    const screenshotPath = await captureFailure(page, "login-failure");
    const hint = screenshotPath
      ? `Check the screenshot at:\n  ${screenshotPath}`
      : "Could not capture screenshot.";
    throw new Error(
      `Could not find email input on login page.\n` +
        `  The site may have changed or is blocking automated access.\n` +
        `  ${hint}`,
      { cause: error }
    );
  }

  await page.locator(LOGIN.PASSWORD_INPUT).fill(config.password);
  await page.locator(LOGIN.CONTINUE_BUTTON).click();

  // Wait for navigation after login
  await page.waitForLoadState("networkidle");

  const debug = process.env.DEBUG === "true" || process.env.DEBUG === "1";
  if (debug) {
    console.log("[DEBUG] Post-login URL:", page.url());
    const title = await page.title();
    console.log("[DEBUG] Post-login title:", title);
  }

  // Check multiple signals that login succeeded:
  // 1. URL changed away from login page
  // 2. Or a known logged-in element is visible
  const stillOnLogin = page.url().toLowerCase().includes("/account/login");
  if (stillOnLogin) {
    if (debug) {
      const body = await page.locator("body").innerText();
      console.log("[DEBUG] Page text (first 500 chars):", body.slice(0, 500));
    }
    throw new Error(
      `Login failed for user "${config.username}". ` +
        "Check credentials and ensure the CourtReserve site is reachable."
    );
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page
      .locator(MY_RESERVATIONS.BOOK_A_COURT_LINK)
      .waitFor({ state: "visible", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
