import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getBookingWindowOpen,
  getWaitMs,
  needsToWait,
  formatCountdown,
  waitForBookingWindow,
  waitForExactWindowOpen,
} from "../../src/booking-window.js";

describe("getBookingWindowOpen", () => {
  it("returns a date exactly 7 days before the slot", () => {
    const result = getBookingWindowOpen("2026-03-27", "22:30");
    const expected = new Date("2026-03-20T22:30:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("handles midnight boundary", () => {
    const result = getBookingWindowOpen("2026-04-01", "00:00");
    const expected = new Date("2026-03-25T00:00:00");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("handles end-of-day slot", () => {
    const result = getBookingWindowOpen("2026-03-28", "23:30");
    const expected = new Date("2026-03-21T23:30:00");
    expect(result.getTime()).toBe(expected.getTime());
  });
});

describe("getWaitMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 when the booking window is already open", () => {
    // Set current time to March 21 at 10pm — slot is March 27 at 10pm
    // Window opened at March 20 at 10pm — already in the past
    vi.setSystemTime(new Date("2026-03-21T22:00:00"));
    expect(getWaitMs("2026-03-27", "22:00")).toBe(0);
  });

  it("returns positive ms when the window has not opened yet", () => {
    // Current time: March 20 at 10:00pm
    // Slot: March 27 at 10:30pm
    // Window opens: March 20 at 10:30pm
    // Target: window open - 30s = March 20 at 10:29:30pm
    // Wait: 29 min 30 sec = 1770000ms
    vi.setSystemTime(new Date("2026-03-20T22:00:00"));
    const waitMs = getWaitMs("2026-03-27", "22:30");
    expect(waitMs).toBe(29 * 60 * 1000 + 30 * 1000);
  });

  it("returns 0 when we are past the lead time window", () => {
    // Current time: March 20 at 10:30pm (window just opened)
    vi.setSystemTime(new Date("2026-03-20T22:30:00"));
    expect(getWaitMs("2026-03-27", "22:30")).toBe(0);
  });

  it("returns small value when we are within lead time of window opening", () => {
    // Current time: March 20 at 10:29:35pm (5s after target)
    // Window opens: 10:30pm, target = 10:29:30pm
    // We're at 10:29:35 which is AFTER target → should return 0
    vi.setSystemTime(new Date("2026-03-20T22:29:35"));
    expect(getWaitMs("2026-03-27", "22:30")).toBe(0);
  });

  it("returns correct wait when window is exactly the lead time away", () => {
    // Current time: March 20 at 10:29:30pm (exactly at target)
    vi.setSystemTime(new Date("2026-03-20T22:29:30"));
    expect(getWaitMs("2026-03-27", "22:30")).toBe(0);
  });

  it("handles slot on the same day (within 7 days)", () => {
    // Current time: March 20 at 8pm, slot: March 20 at 11pm
    // Window opened: March 13 at 11pm — long past
    vi.setSystemTime(new Date("2026-03-20T20:00:00"));
    expect(getWaitMs("2026-03-20", "23:00")).toBe(0);
  });
});

describe("needsToWait", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when slot is within 7 days", () => {
    vi.setSystemTime(new Date("2026-03-20T22:00:00"));
    expect(needsToWait("2026-03-26", "23:00")).toBe(false);
  });

  it("returns true when slot window has not opened", () => {
    vi.setSystemTime(new Date("2026-03-20T22:00:00"));
    expect(needsToWait("2026-03-27", "22:30")).toBe(true);
  });

  it("returns false when window just opened", () => {
    vi.setSystemTime(new Date("2026-03-20T22:30:00"));
    expect(needsToWait("2026-03-27", "22:30")).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("formats seconds only", () => {
    expect(formatCountdown(45_000)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatCountdown(125_000)).toBe("2m 5s");
  });

  it("formats hours, minutes and seconds", () => {
    expect(formatCountdown(3_723_000)).toBe("1h 2m 3s");
  });

  it("formats zero", () => {
    expect(formatCountdown(0)).toBe("0s");
  });

  it("rounds up partial seconds", () => {
    expect(formatCountdown(1_500)).toBe("2s");
  });
});

describe("waitForBookingWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when window is already open", async () => {
    vi.setSystemTime(new Date("2026-03-21T22:00:00"));
    // This should resolve without waiting
    await waitForBookingWindow("2026-03-27", "22:00");
  });

  it("resolves immediately for waitForExactWindowOpen when window is open", async () => {
    vi.setSystemTime(new Date("2026-03-20T22:31:00"));
    await waitForExactWindowOpen("2026-03-27", "22:30");
  });

  it("waitForExactWindowOpen waits until exact moment", async () => {
    // 3 seconds before window opens
    vi.setSystemTime(new Date("2026-03-20T22:29:57"));

    const promise = waitForExactWindowOpen("2026-03-27", "22:30");
    await vi.advanceTimersByTimeAsync(4_000);
    await promise;
  });

  it("waits and resolves when window opens", async () => {
    // Window opens in 35 seconds (lead time 30s, so target is in 5s)
    vi.setSystemTime(new Date("2026-03-20T22:29:25"));

    const promise = waitForBookingWindow("2026-03-27", "22:30");

    // Advance time past the target
    await vi.advanceTimersByTimeAsync(6_000);

    await promise;
  });
});
