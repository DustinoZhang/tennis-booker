import { describe, it, expect, vi, beforeEach } from "vitest";
import { processPayment } from "../../src/browser/payment.js";

/**
 * Creates a mock Playwright Page that mirrors the real processPayment flow:
 *   goto -> waitForLoadState -> locator("body").innerText() (check for no items)
 *   -> regex on body text -> locator(payButton selector).last() -> count/click
 *   -> waitForTimeout -> locator("body").innerText() (success check)
 *   -> locator(confirmButton selector).first() -> count
 */
function makeMockPage(opts: {
  readonly bodyText?: string;
  readonly postClickBodyText?: string;
  readonly payButtonCount?: number;
  readonly payClickThrows?: boolean;
  readonly confirmButtonCount?: number;
  readonly confirmClickThrows?: boolean;
} = {}) {
  const {
    bodyText = "TOTAL DUE: $50.00\nSome other content",
    postClickBodyText = "Payment successful",
    payButtonCount = 1,
    payClickThrows = false,
    confirmButtonCount = 0,
    confirmClickThrows = false,
  } = opts;

  const payButtonLocator = {
    count: vi.fn().mockResolvedValue(payButtonCount),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    click: payClickThrows
      ? vi.fn().mockRejectedValue(new Error("click failed"))
      : vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    last: vi.fn(),
  };
  payButtonLocator.last.mockReturnValue(payButtonLocator);

  const confirmButtonLocator = {
    count: vi.fn().mockResolvedValue(confirmButtonCount),
    click: confirmClickThrows
      ? vi.fn().mockRejectedValue(new Error("click failed"))
      : vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    first: vi.fn(),
  };
  confirmButtonLocator.first.mockReturnValue(confirmButtonLocator);

  // Track innerText call count to return different text before/after click
  let innerTextCallCount = 0;
  const bodyLocator = {
    innerText: vi.fn().mockImplementation(() => {
      innerTextCallCount += 1;
      // First call(s) return bodyText, later calls return postClickBodyText
      // In non-debug mode: call 1 = body check, call 2 = post-click check
      if (innerTextCallCount <= 1) {
        return Promise.resolve(bodyText);
      }
      return Promise.resolve(postClickBodyText);
    }),
  };

  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue("https://app.courtreserve.com/Online/Payments/ProcessPayment/10243"),
    title: vi.fn().mockResolvedValue("Payment"),
    screenshot: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockImplementation((selector: string) => {
      if (selector === "body") {
        return bodyLocator;
      }
      if (selector.includes("Confirm") || selector.includes("Submit") || selector.includes("Process Payment")) {
        return confirmButtonLocator;
      }
      // Pay button selector
      return payButtonLocator;
    }),
  };

  return {
    page,
    payButtonLocator,
    confirmButtonLocator,
    bodyLocator,
  };
}

describe("processPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to the payment URL and waits for load", async () => {
    const { page } = makeMockPage();

    await processPayment(page as never);

    expect(page.goto).toHaveBeenCalledWith(
      "https://app.courtreserve.com/Online/Payments/ProcessPayment/10243"
    );
    expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
  });

  it("returns success with amount when payment completes", async () => {
    const { page } = makeMockPage({
      bodyText: "TOTAL DUE: $50.00",
      postClickBodyText: "Payment successful",
    });

    const result = await processPayment(page as never);

    expect(result).toEqual({
      status: "success",
      message: "Payment of $50.00 submitted",
    });
  });

  it("returns success with 'No payment required' when no booked items exist", async () => {
    const { page } = makeMockPage({
      bodyText: "You don't have any booked items to pay for.",
    });

    const result = await processPayment(page as never);

    expect(result).toEqual({
      status: "success",
      message: "No payment required",
    });
  });

  it("returns success with 'No payment required' when body contains 'No items'", async () => {
    const { page } = makeMockPage({
      bodyText: "No items found for payment.",
    });

    const result = await processPayment(page as never);

    expect(result).toEqual({
      status: "success",
      message: "No payment required",
    });
  });

  it("extracts the total amount from body text via regex", async () => {
    const { page } = makeMockPage({
      bodyText: "Your booking\nTOTAL DUE: $123.45\nPay now",
      postClickBodyText: "Thank you",
    });

    const result = await processPayment(page as never);

    expect(result.status).toBe("success");
    expect(result.message).toContain("$123.45");
  });

  it("reports 'unknown' amount when total cannot be parsed", async () => {
    const { page } = makeMockPage({
      bodyText: "TOTAL DUE: free",
      postClickBodyText: "Paid",
    });

    const result = await processPayment(page as never);

    expect(result.status).toBe("success");
    expect(result.message).toContain("unknown");
  });

  it("returns error when pay button is not found (count=0)", async () => {
    const { page } = makeMockPage({
      bodyText: "TOTAL DUE: $25.00",
      payButtonCount: 0,
    });

    const result = await processPayment(page as never);

    expect(result).toEqual({
      status: "error",
      message: "Could not find Pay button",
    });
  });

  it("clicks the pay button with scrollIntoViewIfNeeded", async () => {
    const { page, payButtonLocator } = makeMockPage();

    await processPayment(page as never);

    expect(payButtonLocator.scrollIntoViewIfNeeded).toHaveBeenCalled();
    expect(payButtonLocator.click).toHaveBeenCalledWith({ timeout: 5000 });
  });

  it("falls back to evaluate click when normal click throws", async () => {
    const { page, payButtonLocator } = makeMockPage({
      payClickThrows: true,
      postClickBodyText: "Receipt for your payment",
    });

    const result = await processPayment(page as never);

    expect(payButtonLocator.click).toHaveBeenCalled();
    expect(payButtonLocator.evaluate).toHaveBeenCalled();
    expect(result.status).toBe("success");
  });

  it("uses the .last() selector for the pay button locator", async () => {
    const { page, payButtonLocator } = makeMockPage();

    await processPayment(page as never);

    expect(payButtonLocator.last).toHaveBeenCalled();
  });

  it("clicks confirmation button when no success indicator and confirm button exists", async () => {
    const { page, confirmButtonLocator } = makeMockPage({
      postClickBodyText: "Please confirm your payment",
      confirmButtonCount: 1,
    });

    const result = await processPayment(page as never);

    expect(confirmButtonLocator.first).toHaveBeenCalled();
    expect(confirmButtonLocator.click).toHaveBeenCalledWith({ timeout: 5000 });
    expect(result.status).toBe("success");
  });

  it("falls back to evaluate click for confirmation button when normal click throws", async () => {
    const { page, confirmButtonLocator } = makeMockPage({
      postClickBodyText: "Please confirm your payment",
      confirmButtonCount: 1,
      confirmClickThrows: true,
    });

    const result = await processPayment(page as never);

    expect(confirmButtonLocator.click).toHaveBeenCalled();
    expect(confirmButtonLocator.evaluate).toHaveBeenCalled();
    expect(result.status).toBe("success");
  });

  it("skips confirmation button when success indicator is already present", async () => {
    const { page, confirmButtonLocator } = makeMockPage({
      postClickBodyText: "Payment successful",
      confirmButtonCount: 1,
    });

    await processPayment(page as never);

    expect(confirmButtonLocator.click).not.toHaveBeenCalled();
  });

  it("recognizes 'Thank you' as a success indicator", async () => {
    const { page } = makeMockPage({
      postClickBodyText: "Thank you for your payment",
    });

    const result = await processPayment(page as never);

    expect(result.status).toBe("success");
  });

  it("recognizes 'Receipt' as a success indicator", async () => {
    const { page } = makeMockPage({
      postClickBodyText: "Receipt #12345",
    });

    const result = await processPayment(page as never);

    expect(result.status).toBe("success");
  });

  it("recognizes 'Paid' as a success indicator", async () => {
    const { page } = makeMockPage({
      postClickBodyText: "Paid in full",
    });

    const result = await processPayment(page as never);

    expect(result.status).toBe("success");
  });

  it("handles Error thrown during page.goto", async () => {
    const { page } = makeMockPage();
    page.goto.mockRejectedValue(new Error("net::ERR_CONNECTION_REFUSED"));

    const result = await processPayment(page as never);

    expect(result).toEqual({
      status: "error",
      message: "Payment failed: net::ERR_CONNECTION_REFUSED",
    });
  });

  it("handles non-Error thrown values", async () => {
    const { page } = makeMockPage();
    page.goto.mockRejectedValue("string error");

    const result = await processPayment(page as never);

    expect(result).toEqual({
      status: "error",
      message: "Payment failed: Unknown payment error",
    });
  });

  it("waits 3 seconds after clicking the pay button", async () => {
    const { page } = makeMockPage();

    await processPayment(page as never);

    expect(page.waitForTimeout).toHaveBeenCalledWith(3000);
  });
});
