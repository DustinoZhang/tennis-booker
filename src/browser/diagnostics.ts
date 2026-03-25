import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";

const PROJECT_ROOT = resolve(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  ".."
);
const DEBUG_DIR = resolve(PROJECT_ROOT, "debug");

/**
 * Capture a screenshot and page metadata on failure.
 * Returns the screenshot path if successful, null otherwise.
 * Never throws -- diagnostics must not mask the real error.
 */
export async function captureFailure(
  page: Page,
  label: string
): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = resolve(DEBUG_DIR, `${label}-${timestamp}.png`);
  try {
    mkdirSync(DEBUG_DIR, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const title = await page.title();
    console.error(`\n  URL:        ${page.url()}`);
    console.error(`  Page title: ${title}`);
    console.error(`  Screenshot: ${screenshotPath}\n`);
    return screenshotPath;
  } catch {
    return null;
  }
}
