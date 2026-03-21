import { describe, it, expect, vi, beforeEach } from "vitest";
import { bookSlot } from "../../src/browser/booking.js";
import type { TimeSlot } from "../../src/types.js";

const testSlot: TimeSlot = {
  court: { id: "2", name: "Court #2", isDoubles: true },
  startTime: "14:00",
  endTime: "15:00",
  date: "2026-03-20",
  isAvailable: true,
};

type LocatorOverrides = {
  waitForBehavior?: "resolve" | "reject";
  countValue?: number;
  innerTextValue?: string;
  evaluateFn?: () => Promise<void>;
  textContent?: string | null;
};

function makeMockLocator(overrides: LocatorOverrides = {}) {
  const {
    waitForBehavior = "resolve",
    countValue = 0,
    innerTextValue = "",
    evaluateFn,
    textContent = null,
  } = overrides;

  const locator: Record<string, ReturnType<typeof vi.fn>> = {
    click: vi.fn().mockResolvedValue(undefined),
    waitFor: waitForBehavior === "resolve"
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new Error("Element not found")),
    evaluate: evaluateFn
      ? vi.fn().mockImplementation(evaluateFn)
      : vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(countValue),
    innerText: vi.fn().mockResolvedValue(innerTextValue),
    textContent: vi.fn().mockResolvedValue(textContent),
    first: vi.fn(),
    nth: vi.fn(),
    locator: vi.fn(),
  };

  // .first() returns the same locator
  locator.first.mockReturnValue(locator);
  // .nth(i) returns a child locator
  locator.nth.mockReturnValue(locator);
  // .locator() for chaining (e.g., errorPopup.locator("xpath=.."))
  locator.locator.mockReturnValue(locator);

  return locator;
}

type PageOptions = {
  modalAppears?: boolean;
  errorPopupVisible?: boolean;
  errorText?: string;
  durationItemCount?: number;
  durationItemText?: string;
};

function makeMockPage(opts: PageOptions = {}) {
  const {
    modalAppears = true,
    errorPopupVisible = false,
    errorText = "Reservation Notice\nCourt unavailable",
    durationItemCount = 3,
    durationItemText = "60 min",
  } = opts;

  // Checkbox locator (DisclosureAgree)
  const checkboxLocator = makeMockLocator({
    waitForBehavior: modalAppears ? "resolve" : "reject",
  });

  // Save button locator
  const saveLocator = makeMockLocator();

  // Error popup locator ("text='Reservation Notice'")
  const errorPopupLocator = makeMockLocator({
    countValue: errorPopupVisible ? 1 : 0,
    innerTextValue: errorText,
  });

  // OK button locator
  const okButtonLocator = makeMockLocator();

  // Close button locator
  const closeButtonLocator = makeMockLocator();

  // Duration list items locator
  const durationListLocator = makeMockLocator({
    textContent: durationItemText,
  });
  durationListLocator.count.mockResolvedValue(durationItemCount);
  durationListLocator.nth.mockReturnValue(
    makeMockLocator({ textContent: durationItemText })
  );

  // Debug popup text locator
  const debugPopupLocator = makeMockLocator({
    innerTextValue: "60 min\n90 min\n120 min",
  });

  const locatorMap: Record<string, ReturnType<typeof makeMockLocator>> = {
    "[data-testid='DisclosureAgree']": checkboxLocator,
    "button:has-text('Save')": saveLocator,
    "text='Reservation Notice'": errorPopupLocator,
    "button:has-text('OK')": okButtonLocator,
    "button:has-text('Close')": closeButtonLocator,
    ".k-animation-container .k-list-item, .k-animation-container li": durationListLocator,
    ".k-animation-container .k-list, .k-animation-container .k-popup": debugPopupLocator,
  };

  return {
    locator: vi.fn().mockImplementation((selector: string) => {
      return locatorMap[selector] ?? makeMockLocator();
    }),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    _locators: locatorMap,
  };
}

describe("bookSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when booking completes without errors", async () => {
    const page = makeMockPage();

    const result = await bookSlot(page as never, testSlot, 60);

    expect(result.status).toBe("success");
    expect(result.message).toContain("Court #2");
    expect(result.message).toContain("2026-03-20");
    expect(result.message).toContain("14:00");
    expect(result.slot).toBe(testSlot);
  });

  it("removes stale .k-animation-container and opens Kendo dropdown via evaluate", async () => {
    const page = makeMockPage({ durationItemText: "1.5 hours" });

    await bookSlot(page as never, testSlot, 90);

    // page.evaluate is called twice for setDuration:
    // 1. Remove stale .k-animation-container
    // 2. Open the Kendo dropdown via ddl.open()
    expect(page.evaluate).toHaveBeenCalledTimes(2);
  });

  it("selects duration by clicking a matching list item", async () => {
    const page = makeMockPage({ durationItemCount: 3, durationItemText: "60 min" });

    await bookSlot(page as never, testSlot, 60);

    // Should query the list items locator
    const listLocator = page._locators[
      ".k-animation-container .k-list-item, .k-animation-container li"
    ];
    expect(listLocator.count).toHaveBeenCalled();

    // Should call nth to iterate over items
    expect(listLocator.nth).toHaveBeenCalled();
  });

  it("falls back to Kendo API when no list item matches", async () => {
    const page = makeMockPage({ durationItemCount: 2, durationItemText: "no match" });

    await bookSlot(page as never, testSlot, 60);

    // 2 calls from setDuration (remove containers + open dropdown) + 1 fallback call
    expect(page.evaluate).toHaveBeenCalledTimes(3);
    // The third call should pass durationMinutes as an argument
    expect(page.evaluate).toHaveBeenNthCalledWith(3, expect.any(Function), 60);
  });

  it("checks the disclosure checkbox via evaluate with scrollIntoView and change event", async () => {
    const page = makeMockPage();

    await bookSlot(page as never, testSlot, 60);

    const checkboxLocator = page._locators["[data-testid='DisclosureAgree']"];

    // waitFor is called to confirm modal is present
    expect(checkboxLocator.waitFor).toHaveBeenCalledWith({
      state: "attached",
      timeout: 15_000,
    });

    // evaluate is called on the checkbox locator to set checked + dispatch change
    expect(checkboxLocator.evaluate).toHaveBeenCalledWith(expect.any(Function));
  });

  it("clicks the Save button after checking the checkbox", async () => {
    const page = makeMockPage();

    await bookSlot(page as never, testSlot, 60);

    // Verify Save locator was created and clicked
    expect(page.locator).toHaveBeenCalledWith("button:has-text('Save')");
    const saveLocator = page._locators["button:has-text('Save')"];
    expect(saveLocator.first).toHaveBeenCalled();
    expect(saveLocator.click).toHaveBeenCalled();
  });

  it("waits for timeout after save to let page process", async () => {
    const page = makeMockPage();

    await bookSlot(page as never, testSlot, 60);

    // waitForTimeout called for: setDuration (500ms) + post-save (3000ms)
    expect(page.waitForTimeout).toHaveBeenCalledWith(500);
    expect(page.waitForTimeout).toHaveBeenCalledWith(3000);
  });

  it("detects Reservation Notice error popup and returns error", async () => {
    const page = makeMockPage({
      errorPopupVisible: true,
      errorText: "Reservation Notice\nCourt is already booked",
    });

    const result = await bookSlot(page as never, testSlot, 60);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Booking rejected");

    // Should click OK to dismiss the error popup
    const okLocator = page._locators["button:has-text('OK')"];
    expect(okLocator.first).toHaveBeenCalled();

    // Should click Close to dismiss the booking modal
    const closeLocator = page._locators["button:has-text('Close')"];
    expect(closeLocator.first).toHaveBeenCalled();
  });

  it("returns error when modal does not appear (checkbox waitFor rejects)", async () => {
    const page = makeMockPage({ modalAppears: false });

    const result = await bookSlot(page as never, testSlot, 60);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Booking failed");
    expect(result.message).toContain("Element not found");
  });

  it("handles non-Error thrown values gracefully", async () => {
    const page = {
      locator: vi.fn().mockReturnValue({
        waitFor: vi.fn().mockRejectedValue("string error"),
        first: vi.fn().mockReturnThis(),
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(0),
        nth: vi.fn().mockReturnThis(),
        locator: vi.fn().mockReturnThis(),
        innerText: vi.fn().mockResolvedValue(""),
        textContent: vi.fn().mockResolvedValue(""),
      }),
      evaluate: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };

    const result = await bookSlot(page as never, testSlot, 60);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Unknown booking error");
  });

  it("waits for networkidle after successful booking", async () => {
    const page = makeMockPage();

    await bookSlot(page as never, testSlot, 60);

    expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
  });
});
