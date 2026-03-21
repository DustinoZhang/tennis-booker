import { describe, it, expect } from "vitest";
import { suggestAlternatives } from "../../src/slot-suggester.js";
import type { TimeSlot, SlotRequest, Court } from "../../src/types.js";

const doubles2: Court = { id: "2", name: "Court #2", isDoubles: true };
const doubles3: Court = { id: "3", name: "Court #3", isDoubles: true };
const singlesCourt: Court = {
  id: "1",
  name: "Court #1 (Singles Court)",
  isDoubles: false,
};

function makeSlot(
  court: Court,
  startTime: string,
  endTime: string
): TimeSlot {
  return { court, startTime, endTime, date: "2026-03-20", isAvailable: true };
}

const request: SlotRequest = {
  date: "2026-03-20",
  startTime: "14:00",
  durationMinutes: 60,
};

describe("suggestAlternatives", () => {
  it("returns closest available slots sorted by time proximity", () => {
    const slots = [
      makeSlot(doubles2, "12:00", "12:30"),
      makeSlot(doubles2, "14:30", "15:00"),
      makeSlot(doubles2, "18:00", "18:30"),
    ];

    const result = suggestAlternatives(slots, request);

    expect(result[0]!.startTime).toBe("14:30");
    expect(result[1]!.startTime).toBe("12:00");
    expect(result[2]!.startTime).toBe("18:00");
  });

  it("defaults to 3 suggestions", () => {
    const slots = [
      makeSlot(doubles2, "11:00", "11:30"),
      makeSlot(doubles2, "12:00", "12:30"),
      makeSlot(doubles2, "13:00", "13:30"),
      makeSlot(doubles2, "15:00", "15:30"),
      makeSlot(doubles2, "16:00", "16:30"),
    ];

    const result = suggestAlternatives(slots, request);

    expect(result).toHaveLength(3);
  });

  it("respects custom limit", () => {
    const slots = [
      makeSlot(doubles2, "12:00", "12:30"),
      makeSlot(doubles2, "15:00", "15:30"),
      makeSlot(doubles2, "16:00", "16:30"),
    ];

    const result = suggestAlternatives(slots, request, 1);

    expect(result).toHaveLength(1);
  });

  it("excludes unavailable slots", () => {
    const unavailable: TimeSlot = {
      court: doubles2,
      startTime: "14:30",
      endTime: "15:00",
      date: "2026-03-20",
      isAvailable: false,
    };
    const slots = [unavailable, makeSlot(doubles2, "16:00", "16:30")];

    const result = suggestAlternatives(slots, request);

    expect(result).toHaveLength(1);
    expect(result[0]!.startTime).toBe("16:00");
  });

  it("excludes the exact requested time slot", () => {
    const slots = [
      makeSlot(doubles2, "14:00", "14:30"), // same as request
      makeSlot(doubles2, "15:00", "15:30"),
    ];

    const result = suggestAlternatives(slots, request);

    expect(result).toHaveLength(1);
    expect(result[0]!.startTime).toBe("15:00");
  });

  it("returns empty array when no alternatives exist", () => {
    const result = suggestAlternatives([], request);

    expect(result).toEqual([]);
  });

  it("prefers doubles courts when times are equal", () => {
    const slots = [
      makeSlot(singlesCourt, "15:00", "15:30"),
      makeSlot(doubles2, "15:00", "15:30"),
    ];

    const result = suggestAlternatives(slots, request, 1);

    expect(result[0]!.court.isDoubles).toBe(true);
  });

  it("sorts singles after doubles when times are equal", () => {
    const slots = [
      makeSlot(doubles2, "15:00", "15:30"),
      makeSlot(singlesCourt, "15:00", "15:30"),
    ];

    const result = suggestAlternatives(slots, request, 2);

    expect(result[0]!.court.isDoubles).toBe(true);
    expect(result[1]!.court.isDoubles).toBe(false);
  });

  it("keeps same-type courts in stable order", () => {
    const slots = [
      makeSlot(doubles3, "15:00", "15:30"),
      makeSlot(doubles2, "15:00", "15:30"),
    ];

    const result = suggestAlternatives(slots, request, 2);

    expect(result).toHaveLength(2);
  });

  it("returns a frozen array", () => {
    const slots = [makeSlot(doubles2, "15:00", "15:30")];

    const result = suggestAlternatives(slots, request);

    expect(Object.isFrozen(result)).toBe(true);
  });
});
