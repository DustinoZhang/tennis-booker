import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable, Writable } from "node:stream";

vi.mock("node:readline/promises", () => {
  const mockRl = {
    question: vi.fn(),
    close: vi.fn(),
  };

  return {
    createInterface: vi.fn().mockReturnValue(mockRl),
    __mockRl: mockRl,
  };
});

import * as readlineMod from "node:readline/promises";
import { promptForSlot } from "../../src/prompts.js";

const mockRl = (readlineMod as unknown as { __mockRl: { question: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } }).__mockRl;

describe("promptForSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log from "Available durations" line
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns a frozen SlotRequest from user input", async () => {
    mockRl.question
      .mockResolvedValueOnce("2026-04-01")  // date
      .mockResolvedValueOnce("14:00")       // start time
      .mockResolvedValueOnce("90");          // duration

    const result = await promptForSlot();

    expect(result).toEqual({
      date: "2026-04-01",
      startTime: "14:00",
      durationMinutes: 90,
      addToCalendar: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("uses today as default when date is empty", async () => {
    const today = new Date().toISOString().split("T")[0]!;

    mockRl.question
      .mockResolvedValueOnce("")            // empty = default
      .mockResolvedValueOnce("14:00")
      .mockResolvedValueOnce("60");

    const result = await promptForSlot();

    expect(result.date).toBe(today);
  });

  it("closes the readline interface after completion", async () => {
    mockRl.question
      .mockResolvedValueOnce("2026-04-01")
      .mockResolvedValueOnce("14:00")
      .mockResolvedValueOnce("60");

    await promptForSlot();

    expect(mockRl.close).toHaveBeenCalledTimes(1);
  });

  it("retries when validation fails then accepts valid input", async () => {
    mockRl.question
      .mockResolvedValueOnce("2026-04-01")  // valid date
      .mockResolvedValueOnce("99:99")       // invalid time -> retry
      .mockResolvedValueOnce("14:00")       // valid time
      .mockResolvedValueOnce("60");          // valid duration

    const result = await promptForSlot();

    expect(result.startTime).toBe("14:00");
    // console.log should have been called with the error message
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Error:")
    );
  });

  it("closes the readline interface even if an error occurs", async () => {
    mockRl.question.mockRejectedValueOnce(new Error("stdin closed"));

    await expect(promptForSlot()).rejects.toThrow("stdin closed");

    expect(mockRl.close).toHaveBeenCalledTimes(1);
  });
});
