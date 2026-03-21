import { describe, it, expect } from "vitest";
import { timeToMinutes, minutesToTime } from "../../src/time-utils.js";

describe("timeToMinutes", () => {
  it("converts 00:00 to 0", () => {
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("converts 14:30 to 870", () => {
    expect(timeToMinutes("14:30")).toBe(870);
  });

  it("converts 23:59 to 1439", () => {
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("throws on missing colon", () => {
    expect(() => timeToMinutes("1400")).toThrow('Invalid time format: "1400"');
  });

  it("throws on empty string", () => {
    expect(() => timeToMinutes("")).toThrow('Invalid time format: ""');
  });

  it("throws on non-numeric parts", () => {
    expect(() => timeToMinutes("ab:cd")).toThrow('Invalid time format: "ab:cd"');
  });
});

describe("minutesToTime", () => {
  it("converts 0 to 00:00", () => {
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("converts 870 to 14:30", () => {
    expect(minutesToTime(870)).toBe("14:30");
  });

  it("converts 1439 to 23:59", () => {
    expect(minutesToTime(1439)).toBe("23:59");
  });

  it("pads single-digit hours and minutes", () => {
    expect(minutesToTime(65)).toBe("01:05");
  });
});
