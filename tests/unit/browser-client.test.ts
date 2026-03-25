import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock playwright before importing the module under test.
// The mock must be hoisted so it runs before the import resolves.
vi.mock("playwright", () => {
  const mockPage = {
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    addInitScript: vi.fn().mockResolvedValue(undefined),
  };

  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser),
    },
  };
});

import { chromium } from "playwright";
import { launchBrowser, closeBrowser } from "../../src/browser/client.js";
import type { Config } from "../../src/config.js";

const baseConfig: Config = {
  username: "user@example.com",
  password: "secret123",
  debug: false,
  baseUrl: "https://app.courtreserve.com/Online/Reservations/Index/10243",
};

describe("launchBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("launches chromium in headless mode when debug is false", async () => {
    await launchBrowser(baseConfig);

    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true })
    );
  });

  it("launches chromium in headed mode when debug is true", async () => {
    const debugConfig: Config = { ...baseConfig, debug: true };

    await launchBrowser(debugConfig);

    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: false })
    );
  });

  it("creates a new browser context", async () => {
    const { browser } = await launchBrowser(baseConfig);

    expect(browser.newContext).toHaveBeenCalledTimes(1);
  });

  it("creates a new page from the context", async () => {
    await launchBrowser(baseConfig);

    // Access the mock context to verify newPage was called
    const mockBrowser = await (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]!.value;
    const mockContext = await mockBrowser.newContext.mock.results[0]!.value;
    expect(mockContext.newPage).toHaveBeenCalledTimes(1);
  });

  it("sets default navigation timeout to 30000ms on the page", async () => {
    const { page } = await launchBrowser(baseConfig);

    expect(page.setDefaultNavigationTimeout).toHaveBeenCalledWith(30000);
  });

  it("sets default action timeout to 10000ms on the page", async () => {
    const { page } = await launchBrowser(baseConfig);

    expect(page.setDefaultTimeout).toHaveBeenCalledWith(10000);
  });

  it("returns both browser and page", async () => {
    const result = await launchBrowser(baseConfig);

    expect(result).toHaveProperty("browser");
    expect(result).toHaveProperty("page");
  });

  it("closes browser if context creation fails", async () => {
    const mockBrowser = {
      newContext: vi.fn().mockRejectedValue(new Error("context error")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockBrowser
    );

    await expect(launchBrowser(baseConfig)).rejects.toThrow("context error");
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it("creates context with 1280x720 viewport", async () => {
    await launchBrowser(baseConfig);

    const mockBrowser = await (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]!.value;
    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 1280, height: 720 },
      })
    );
  });
});

describe("closeBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls browser.close()", async () => {
    const { browser } = await launchBrowser(baseConfig);

    await closeBrowser(browser);

    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("returns void (resolves to undefined)", async () => {
    const { browser } = await launchBrowser(baseConfig);

    const result = await closeBrowser(browser);

    expect(result).toBeUndefined();
  });
});
