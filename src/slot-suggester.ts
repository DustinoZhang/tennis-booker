import type { TimeSlot, SlotRequest } from "./types.js";
import { timeToMinutes } from "./time-utils.js";

export function suggestAlternatives(
  availableSlots: readonly TimeSlot[],
  request: SlotRequest,
  limit: number = 3
): readonly TimeSlot[] {
  const requestMinutes = timeToMinutes(request.startTime);

  const candidates = availableSlots.filter(
    (slot) =>
      slot.date === request.date &&
      slot.isAvailable &&
      slot.startTime !== request.startTime
  );

  const sorted = [...candidates].sort((a, b) => {
    const distA = Math.abs(timeToMinutes(a.startTime) - requestMinutes);
    const distB = Math.abs(timeToMinutes(b.startTime) - requestMinutes);

    if (distA !== distB) return distA - distB;

    // Prefer doubles when distance is equal
    if (a.court.isDoubles && !b.court.isDoubles) return -1;
    if (!a.court.isDoubles && b.court.isDoubles) return 1;

    return 0;
  });

  return Object.freeze(sorted.slice(0, limit));
}
