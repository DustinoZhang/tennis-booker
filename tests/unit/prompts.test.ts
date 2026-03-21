import { describe, it, expect } from "vitest";
import {
  validateDate,
  validateStartTime,
  validateDuration,
  computeEndTime,
  VALID_DURATIONS,
  CLOSING_TIME,
} from "../../src/prompts.js";

describe("validateDate", () => {
  it("accepts a future date in YYYY-MM-DD format", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0]!;

    expect(validateDate(dateStr)).toBe(true);
  });

  it("accepts today's date", () => {
    const today = new Date().toISOString().split("T")[0]!;

    expect(validateDate(today)).toBe(true);
  });

  it("rejects a past date", () => {
    const result = validateDate("2020-01-01");

    expect(result).toBe("Date must be today or in the future");
  });

  it("rejects invalid date format", () => {
    const result = validateDate("not-a-date");

    expect(result).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("rejects empty string", () => {
    const result = validateDate("");

    expect(result).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("rejects date with wrong separator", () => {
    const result = validateDate("2026/03/20");

    expect(result).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("rejects date that matches format but is invalid (e.g. month 99)", () => {
    const result = validateDate("2026-99-99");

    expect(result).toBe("Invalid date format. Use YYYY-MM-DD");
  });
});

describe("validateStartTime", () => {
  it("accepts valid time within operating hours", () => {
    expect(validateStartTime("14:00")).toBe(true);
  });

  it("accepts opening time (06:00)", () => {
    expect(validateStartTime("06:00")).toBe(true);
  });

  it("accepts 23:00 (fits 30 and 60 min before midnight)", () => {
    expect(validateStartTime("23:00")).toBe(true);
  });

  it("accepts 23:30 (fits 30 min before midnight)", () => {
    expect(validateStartTime("23:30")).toBe(true);
  });

  it("rejects time where no duration fits before closing", () => {
    const result = validateStartTime("23:31");

    expect(result).toBe(
      "Start time must be 23:30 or earlier to fit the shortest booking"
    );
  });

  it("rejects semantically invalid time like 12:60", () => {
    const result = validateStartTime("12:60");

    expect(result).toBe("Invalid time format. Use HH:MM (24-hour)");
  });

  it("rejects hour 25", () => {
    const result = validateStartTime("25:00");

    expect(result).toBe("Invalid time format. Use HH:MM (24-hour)");
  });

  it("rejects invalid format", () => {
    const result = validateStartTime("9am");

    expect(result).toBe("Invalid time format. Use HH:MM (24-hour)");
  });

  it("rejects empty string", () => {
    const result = validateStartTime("");

    expect(result).toBe("Invalid time format. Use HH:MM (24-hour)");
  });

  it("rejects time before opening", () => {
    const result = validateStartTime("05:00");

    expect(result).toBe("Start time must be 06:00 or later");
  });
});

describe("validateDuration", () => {
  it("accepts 30 minutes", () => {
    expect(validateDuration(30, "14:00")).toBe(true);
  });

  it("accepts 60 minutes", () => {
    expect(validateDuration(60, "14:00")).toBe(true);
  });

  it("accepts 90 minutes", () => {
    expect(validateDuration(90, "14:00")).toBe(true);
  });

  it("accepts 120 minutes", () => {
    expect(validateDuration(120, "14:00")).toBe(true);
  });

  it("accepts 60 min at 23:00 (ends at midnight)", () => {
    expect(validateDuration(60, "23:00")).toBe(true);
  });

  it("rejects duration that exceeds closing time", () => {
    const result = validateDuration(90, "23:00");

    expect(result).toBe(
      `Booking would end after closing time (${CLOSING_TIME})`
    );
  });

  it("rejects invalid duration value", () => {
    const result = validateDuration(45, "14:00");

    expect(result).toBe(
      `Duration must be one of: ${VALID_DURATIONS.join(", ")} minutes`
    );
  });
});

describe("computeEndTime", () => {
  it("adds 30 minutes to start time", () => {
    expect(computeEndTime("11:00", 30)).toBe("11:30");
  });

  it("adds 60 minutes to start time", () => {
    expect(computeEndTime("14:00", 60)).toBe("15:00");
  });

  it("adds 90 minutes to start time", () => {
    expect(computeEndTime("14:00", 90)).toBe("15:30");
  });

  it("adds 120 minutes to start time", () => {
    expect(computeEndTime("14:00", 120)).toBe("16:00");
  });

  it("handles crossing into afternoon", () => {
    expect(computeEndTime("11:30", 90)).toBe("13:00");
  });

  it("handles half-hour start times", () => {
    expect(computeEndTime("14:30", 60)).toBe("15:30");
  });

  it("computes midnight end time", () => {
    expect(computeEndTime("23:00", 60)).toBe("24:00");
  });
});
