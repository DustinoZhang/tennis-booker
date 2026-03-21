import { describe, it, expect, vi, beforeEach } from "vitest";
import { getExistingBookings } from "../../src/browser/reservations.js";

function makeMockPage(cardTexts: string[]) {
  const cards = cardTexts.map((text) => ({
    textContent: vi.fn().mockResolvedValue(text),
  }));

  return {
    goto: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({
      waitFor: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      all: vi.fn().mockResolvedValue(cards),
      count: vi.fn().mockResolvedValue(cards.length),
    }),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
  };
}

describe("getExistingBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a PM booking correctly", async () => {
    const page = makeMockPage([
      "Court Reservation Mon, Mar 23rd, 10:30 PM - 11:30 PM Dustin Zhang Court #2",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-23");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.startTime).toBe("22:30");
    expect(bookings[0]!.endTime).toBe("23:30");
    expect(bookings[0]!.court.name).toBe("Court #2");
    expect(bookings[0]!.court.isDoubles).toBe(true);
  });

  it("parses an AM booking correctly", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 11:00 AM - 12:00 PM Dustin Zhang Court #3",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.startTime).toBe("11:00");
    expect(bookings[0]!.endTime).toBe("12:00");
  });

  it("handles 12:00 AM correctly (midnight)", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 12:00 AM - 12:30 AM Dustin Zhang Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.startTime).toBe("00:00");
    expect(bookings[0]!.endTime).toBe("00:30");
  });

  it("handles 12:00 PM correctly (noon)", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 12:00 PM - 1:00 PM Dustin Zhang Court #4",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.startTime).toBe("12:00");
    expect(bookings[0]!.endTime).toBe("13:00");
  });

  it("identifies Court #1 as singles", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 2:00 PM - 3:00 PM Dustin Zhang Court #1",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.court.isDoubles).toBe(false);
  });

  it("returns empty array when no bookings exist", async () => {
    const page = makeMockPage([]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });

  it("filters bookings to the requested date", async () => {
    const page = makeMockPage([
      "Court Reservation Mon, Mar 23rd, 10:30 PM - 11:30 PM Dustin Zhang Court #2",
      "Court Reservation Fri, Mar 20th, 2:00 PM - 3:00 PM Dustin Zhang Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.court.name).toBe("Court #5");
  });

  it("returns a frozen array", async () => {
    const page = makeMockPage([]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(Object.isFrozen(bookings)).toBe(true);
  });

  it("navigates to the my-reservations page", async () => {
    const page = makeMockPage([]);

    await getExistingBookings(page as never, "2026-03-20");

    expect(page.goto).toHaveBeenCalled();
  });

  it("handles cards with unrecognized format gracefully", async () => {
    const page = makeMockPage(["Some random text with no court info"]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });

  it("handles card with null text content", async () => {
    const cards = [{ textContent: vi.fn().mockResolvedValue(null) }];
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(cards),
      }),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });

  it("handles invalid date format", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 2:00 PM - 3:00 PM Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "invalid");

    expect(bookings).toEqual([]);
  });

  it("handles date with invalid month index", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 2:00 PM - 3:00 PM Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-15-20");

    expect(bookings).toEqual([]);
  });

  it("handles card with date match but no time match", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, notime Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });

  it("handles single-digit date in card", async () => {
    const page = makeMockPage([
      "Court Reservation Sat, Mar 5th, 2:00 PM - 3:00 PM Dustin Zhang Court #3",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-05");

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.court.name).toBe("Court #3");
  });

  it("handles card with date and time but malformed time", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, bad:time XM - bad:time XM Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });

  it("handles card with date and court but only start time is valid", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 2:00 PM - bad:time XM Court #5",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });

  it("handles card with date match but no court number", async () => {
    const page = makeMockPage([
      "Court Reservation Fri, Mar 20th, 2:00 PM - 3:00 PM Dustin Zhang",
    ]);

    const bookings = await getExistingBookings(page as never, "2026-03-20");

    expect(bookings).toEqual([]);
  });
});
