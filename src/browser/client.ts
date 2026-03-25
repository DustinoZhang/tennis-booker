import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import type { Config } from "../config.js";

const NAVIGATION_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 10_000;
const VIEWPORT = { width: 1280, height: 720 } as const;

// Realistic Chrome user-agent to avoid Cloudflare bot detection.
// Playwright's bundled Chromium advertises "HeadlessChrome" which triggers blocks.
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type BrowserSession = {
  readonly browser: Browser;
  readonly page: Page;
};

export async function launchBrowser(config: Config): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: !config.debug,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      userAgent: CHROME_USER_AGENT,
    });

    const page = await context.newPage();

    // Remove navigator.webdriver flag that Cloudflare checks
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);

    return { browser, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
