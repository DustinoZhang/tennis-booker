import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../src/retry.js";

describe("withRetry", () => {
  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns result when it eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 })
    ).rejects.toThrow("always fails");

    // 1 initial + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff with delays between retries", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, {
      maxRetries: 1,
      baseDelayMs: 100,
      maxDelayMs: 5000,
    });

    // Advance past the delay
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe("ok");
    vi.useRealTimers();
  });

  it("caps delay at maxDelayMs", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.stubGlobal(
      "setTimeout",
      (fn: () => void, ms?: number) => {
        delays.push(ms ?? 0);
        return originalSetTimeout(fn, 0); // run instantly for test speed
      }
    );

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockResolvedValue("ok");

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 250 });

    // All delays should be <= maxDelayMs (250)
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(250);
    }

    vi.unstubAllGlobals();
  });

  it("wraps non-Error thrown values into Error objects", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 10 })
    ).rejects.toThrow("string error");
  });

  it("stops retrying when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("auth failed"));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        shouldRetry,
      })
    ).rejects.toThrow("auth failed");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it("continues retrying when shouldRetry returns true", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");
    const shouldRetry = vi.fn().mockReturnValue(true);

    const result = await withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 1,
      maxDelayMs: 10,
      shouldRetry,
    });

    expect(result).toBe("ok");
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it("works with zero retries (just one attempt)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 10 })
    ).rejects.toThrow("fail");

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
