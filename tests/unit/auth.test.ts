import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, isLoggedIn } from "../../src/browser/auth.js";
import type { Config } from "../../src/config.js";

// ---------------------------------------------------------------------------
// Helpers to build mock Page objects
// ---------------------------------------------------------------------------

type MockLocator = {
  fill: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
  waitFor: ReturnType<typeof vi.fn>;
  innerText: ReturnType<typeof vi.fn>;
};

function makeMockLocator(overrides: Partial<MockLocator> = {}): MockLocator {
  return {
    fill: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue(""),
    ...overrides,
  };
}

type MockPage = {
  goto: ReturnType<typeof vi.fn>;
  locator: ReturnType<typeof vi.fn>;
  waitForLoadState: ReturnType<typeof vi.fn>;
  url: ReturnType<typeof vi.fn>;
  title: ReturnType<typeof vi.fn>;
};

function makeMockPage(
  locatorOverrides: Record<string, Partial<MockLocator>> = {},
  pageOverrides: Partial<Pick<MockPage, "url" | "title">> = {}
): MockPage {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    url: pageOverrides.url ?? vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Reservations/Index/10243"),
    title: pageOverrides.title ?? vi.fn().mockResolvedValue("CourtReserve"),
    locator: vi.fn().mockImplementation((selector: string) => {
      const override = locatorOverrides[selector] ?? {};
      return makeMockLocator(override);
    }),
  };
}

const baseConfig: Config = {
  username: "user@example.com",
  password: "secret123",
  debug: false,
  baseUrl: "https://app.courtreserve.com/Online/Reservations/Index/10243",
};

const LOGIN_URL = "https://app.courtreserve.com/Online/Account/Login/10243";

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEBUG;
  });

  it("navigates to the login URL", async () => {
    const page = makeMockPage();

    await login(page as never, baseConfig);

    expect(page.goto).toHaveBeenCalledWith(LOGIN_URL);
  });

  it("fills in the email using the email selector", async () => {
    const page = makeMockPage();

    await login(page as never, baseConfig);

    const calls: string[] = (page.locator as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string
    );
    expect(calls.some((s) => s.includes("Email") || s.includes("email"))).toBe(true);
  });

  it("fills in the password using the password selector", async () => {
    const page = makeMockPage();

    await login(page as never, baseConfig);

    const calls: string[] = (page.locator as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string
    );
    expect(calls.some((s) => s.includes("Password") || s.includes("password"))).toBe(true);
  });

  it("fills email input with the config username", async () => {
    const filledValues: string[] = [];

    const page: MockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Reservations/Index/10243"),
      title: vi.fn().mockResolvedValue("CourtReserve"),
      locator: vi.fn().mockImplementation(() =>
        makeMockLocator({
          fill: vi.fn().mockImplementation(async (val: string) => {
            filledValues.push(val);
          }),
        })
      ),
    };

    await login(page as never, baseConfig);

    expect(filledValues).toContain(baseConfig.username);
  });

  it("fills password input with the config password", async () => {
    const filledValues: string[] = [];

    const page: MockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Reservations/Index/10243"),
      title: vi.fn().mockResolvedValue("CourtReserve"),
      locator: vi.fn().mockImplementation(() =>
        makeMockLocator({
          fill: vi.fn().mockImplementation(async (val: string) => {
            filledValues.push(val);
          }),
        })
      ),
    };

    await login(page as never, baseConfig);

    expect(filledValues).toContain(baseConfig.password);
  });

  it("clicks the Continue button", async () => {
    const clickedSelectors: string[] = [];

    const page: MockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Reservations/Index/10243"),
      title: vi.fn().mockResolvedValue("CourtReserve"),
      locator: vi.fn().mockImplementation((selector: string) =>
        makeMockLocator({
          fill: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockImplementation(async () => {
            clickedSelectors.push(selector);
          }),
        })
      ),
    };

    await login(page as never, baseConfig);

    expect(
      clickedSelectors.some((s) => s.includes("Continue") || s.includes("continue"))
    ).toBe(true);
  });

  it("waits for networkidle after submitting login form", async () => {
    const page = makeMockPage();

    await login(page as never, baseConfig);

    expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
  });

  it("succeeds when URL no longer contains /account/login", async () => {
    const page = makeMockPage({}, {
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Reservations/Index/10243"),
    });

    await expect(login(page as never, baseConfig)).resolves.toBeUndefined();
  });

  it("throws a descriptive error when URL still contains /account/login", async () => {
    const page = makeMockPage({}, {
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Account/Login/10243"),
    });

    await expect(login(page as never, baseConfig)).rejects.toThrow(/login failed/i);
  });

  it("includes the username in the error message on failure", async () => {
    const page = makeMockPage({}, {
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Account/Login/10243"),
    });

    await expect(login(page as never, baseConfig)).rejects.toThrow(baseConfig.username);
  });

  it("checks login status using case-insensitive URL comparison", async () => {
    // URL with mixed case should still be detected as login page
    const page = makeMockPage({}, {
      url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Account/LOGIN/10243"),
    });

    await expect(login(page as never, baseConfig)).rejects.toThrow(/login failed/i);
  });
});

// ---------------------------------------------------------------------------
// isLoggedIn()
// ---------------------------------------------------------------------------

describe("isLoggedIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when waitFor resolves (element is visible)", async () => {
    const page = makeMockPage();
    (page.locator as ReturnType<typeof vi.fn>).mockImplementation(() =>
      makeMockLocator({ waitFor: vi.fn().mockResolvedValue(undefined) })
    );

    const result = await isLoggedIn(page as never);

    expect(result).toBe(true);
  });

  it("returns false when waitFor rejects (element not found)", async () => {
    const page = makeMockPage();
    (page.locator as ReturnType<typeof vi.fn>).mockImplementation(() =>
      makeMockLocator({
        waitFor: vi.fn().mockRejectedValue(new Error("timeout")),
      })
    );

    const result = await isLoggedIn(page as never);

    expect(result).toBe(false);
  });

  it("calls locator with a selector that identifies post-login state", async () => {
    const page = makeMockPage();

    await isLoggedIn(page as never);

    const calls: string[] = (page.locator as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string
    );
    expect(
      calls.some(
        (s) =>
          s.includes("Book a Court") ||
          s.includes("Book") ||
          s.includes("nav") ||
          s.includes("navbar") ||
          s.includes("user") ||
          s.includes("account")
      )
    ).toBe(true);
  });
});
