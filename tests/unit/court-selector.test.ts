import { describe, it, expect } from "vitest";
import { selectCourt } from "../../src/court-selector.js";
import type { TimeSlot, SlotRequest, Court } from "../../src/types.js";

const singlesCourt: Court = {
  id: "1",
  name: "Court #1 (Singles Court)",
  isDoubles: false,
};
const doubles2: Court = { id: "2", name: "Court #2", isDoubles: true };
const doubles3: Court = { id: "3", name: "Court #3", isDoubles: true };

function makeSlot(
  court: Court,
  startTime: string,
  endTime: string,
  isAvailable = true
): TimeSlot {
  return { court, startTime, endTime, date: "2026-03-20", isAvailable };
}

const baseRequest: SlotRequest = {
  date: "2026-03-20",
  startTime: "14:00",
  durationMinutes: 60,
};

describe("selectCourt", () => {
  it("returns a doubles court when available at the requested time", () => {
    const slots = [
      makeSlot(singlesCourt, "14:00", "14:30"),
      makeSlot(doubles2, "14:00", "14:30"),
      makeSlot(doubles3, "14:00", "14:30"),
    ];

    const result = selectCourt(slots, baseRequest);

    expect(result).not.toBeNull();
    expect(result!.court.isDoubles).toBe(true);
  });

  it("prefers doubles courts over singles", () => {
    const slots = [
      makeSlot(singlesCourt, "14:00", "14:30"),
      makeSlot(doubles2, "14:00", "14:30"),
    ];

    const result = selectCourt(slots, baseRequest);

    expect(result!.court.id).toBe("2");
  });

  it("falls back to singles court when no doubles are available", () => {
    const slots = [makeSlot(singlesCourt, "14:00", "14:30")];

    const result = selectCourt(slots, baseRequest);

    expect(result).not.toBeNull();
    expect(result!.court.id).toBe("1");
  });

  it("returns null when no slots match the requested time", () => {
    const slots = [makeSlot(doubles2, "16:00", "16:30")];

    const result = selectCourt(slots, baseRequest);

    expect(result).toBeNull();
  });

  it("returns null when matching slots are not available", () => {
    const slots = [makeSlot(doubles2, "14:00", "14:30", false)];

    const result = selectCourt(slots, baseRequest);

    expect(result).toBeNull();
  });

  it("returns null for an empty slots array", () => {
    const result = selectCourt([], baseRequest);

    expect(result).toBeNull();
  });

  it("picks the lowest-numbered doubles court when multiple are available", () => {
    const slots = [
      makeSlot(doubles3, "14:00", "14:30"),
      makeSlot(doubles2, "14:00", "14:30"),
    ];

    const result = selectCourt(slots, baseRequest);

    expect(result!.court.id).toBe("2");
  });

  it("sorts singles after doubles regardless of id order", () => {
    const slots = [
      makeSlot(doubles2, "14:00", "14:30"),
      makeSlot(singlesCourt, "14:00", "14:30"),
    ];

    const result = selectCourt(slots, baseRequest);

    expect(result!.court.isDoubles).toBe(true);
  });

  it("handles all singles courts by picking first by id", () => {
    const singles2: Court = { id: "0", name: "Court #0", isDoubles: false };
    const slots = [
      makeSlot(singlesCourt, "14:00", "14:30"),
      makeSlot(singles2, "14:00", "14:30"),
    ];

    const result = selectCourt(slots, baseRequest);

    expect(result!.court.id).toBe("0");
  });
});
