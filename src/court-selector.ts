import type { TimeSlot, SlotRequest } from "./types.js";

export function selectCourt(
  availableSlots: readonly TimeSlot[],
  request: SlotRequest
): TimeSlot | null {
  const matching = availableSlots.filter(
    (slot) =>
      slot.date === request.date &&
      slot.startTime === request.startTime &&
      slot.isAvailable
  );

  if (matching.length === 0) {
    return null;
  }

  const sorted = [...matching].sort((a, b) => {
    // Doubles first
    if (a.court.isDoubles && !b.court.isDoubles) return -1;
    if (!a.court.isDoubles && b.court.isDoubles) return 1;
    // Then by court id (lowest first)
    return a.court.id.localeCompare(b.court.id);
  });

  return sorted[0]!;
}
