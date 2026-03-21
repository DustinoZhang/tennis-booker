import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAvailableSlots,
  clickReserveButton,
} from "../../src/browser/availability.js";
import type { TimeSlot } from "../../src/types.js";

// ---------- helpers ----------

type ButtonAttrs = {
  start: string | null;
  end: string | null;
  "data-courtlabel": string | null;
};

function makeButton(attrs: ButtonAttrs) {
  return {
    getAttribute: vi.fn().mockImplementation((attr: string) => {
      if (attr === "start") return attrs.start;
      if (attr === "end") return attrs.end;
      if (attr === "data-courtlabel") return attrs["data-courtlabel"];
      return null;
    }),
    evaluate: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockPage(buttons: ButtonAttrs[]) {
  const buttonLocators = buttons.map((b) => makeButton(b));

  return {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockImplementation((_selector: string) => ({
      all: vi.fn().mockResolvedValue(buttonLocators),
    })),
    _buttons: buttonLocators,
  };
}

const BASE_URL =
  "https://app.courtreserve.com/Online/Reservations/Index/10243";

// ---------- getAvailableSlots ----------

describe("getAvailableSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to the base URL without a date query param", async () => {
    const page = makeMockPage([]);

    await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(page.goto).toHaveBeenCalledWith(BASE_URL);
  });

  it("uses page.evaluate to navigate to the target date via Kendo scheduler", async () => {
    const page = makeMockPage([]);

    await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      "2026-03-20"
    );
  });

  it("waits for networkidle after goto and after date navigation", async () => {
    const page = makeMockPage([]);

    await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    // Called twice: once after goto, once after navigateToDate
    expect(page.waitForLoadState).toHaveBeenCalledTimes(2);
    expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
  });

  it("parses reserve buttons into TimeSlot objects", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      court: { id: "2", name: "Court #2 Doubles", isDoubles: true },
      startTime: "14:00",
      endTime: "14:30",
      date: "2026-03-20",
      isAvailable: true,
    });
  });

  it("identifies singles courts via label containing 'Singles'", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T10:00:00",
        end: "2026-03-20T10:30:00",
        "data-courtlabel": "Court #1 (Singles Court) Singles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toHaveLength(1);
    expect(result[0]!.court.isDoubles).toBe(false);
    expect(result[0]!.court.id).toBe("1");
  });

  it("identifies doubles courts (no 'Singles' in label)", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T10:00:00",
        end: "2026-03-20T10:30:00",
        "data-courtlabel": "Court #3 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result[0]!.court.isDoubles).toBe(true);
    expect(result[0]!.court.id).toBe("3");
  });

  it("filters out buttons whose parsed date does not match the target date", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-21T14:00:00",
        end: "2026-03-21T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
      {
        start: "2026-03-20T16:00:00",
        end: "2026-03-20T16:30:00",
        "data-courtlabel": "Court #4 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toHaveLength(1);
    expect(result[0]!.startTime).toBe("16:00");
    expect(result[0]!.court.name).toBe("Court #4 Doubles");
  });

  it("returns a frozen array", async () => {
    const page = makeMockPage([]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(Object.isFrozen(result)).toBe(true);
  });

  it("returns empty array when no reserve buttons exist", async () => {
    const page = makeMockPage([]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toEqual([]);
  });

  it("skips buttons missing the start attribute", async () => {
    const page = makeMockPage([
      {
        start: null,
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toEqual([]);
  });

  it("skips buttons missing the end attribute", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: null,
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toEqual([]);
  });

  it("skips buttons missing the data-courtlabel attribute", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": null,
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toEqual([]);
  });

  it("marks all parsed slots as available", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T09:00:00",
        end: "2026-03-20T09:30:00",
        "data-courtlabel": "Court #5 Doubles",
      },
      {
        start: "2026-03-20T09:30:00",
        end: "2026-03-20T10:00:00",
        "data-courtlabel": "Court #5 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toHaveLength(2);
    expect(result.every((s) => s.isAvailable)).toBe(true);
  });

  it("sets the correct date on returned slots", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result[0]!.date).toBe("2026-03-20");
  });

  it("handles multiple buttons across different courts", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #1 (Singles Court) Singles",
      },
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #3 Doubles",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result).toHaveLength(3);
    expect(result[0]!.court.isDoubles).toBe(false);
    expect(result[1]!.court.isDoubles).toBe(true);
    expect(result[2]!.court.isDoubles).toBe(true);
  });

  it("defaults court id to '0' when label has no Court # pattern", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Some Unlabeled Court",
      },
    ]);

    const result = await getAvailableSlots(page as never, BASE_URL, "2026-03-20");

    expect(result[0]!.court.id).toBe("0");
    expect(result[0]!.court.name).toBe("Some Unlabeled Court");
  });
});

// ---------- clickReserveButton ----------

describe("clickReserveButton", () => {
  const slot: TimeSlot = {
    court: { id: "2", name: "Court #2 Doubles", isDoubles: true },
    startTime: "14:00",
    endTime: "14:30",
    date: "2026-03-20",
    isAvailable: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicks the matching reserve button via native click", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    await clickReserveButton(page as never, slot);

    expect(page._buttons[0]!.evaluate).toHaveBeenCalledWith(expect.any(Function));
  });

  it("throws when no matching button is found", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T15:00:00",
        end: "2026-03-20T15:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    await expect(clickReserveButton(page as never, slot)).rejects.toThrow(
      "Reserve button not found for Court #2 Doubles at 14:00"
    );
  });

  it("throws when page has no reserve buttons at all", async () => {
    const page = makeMockPage([]);

    await expect(clickReserveButton(page as never, slot)).rejects.toThrow(
      "Reserve button not found"
    );
  });

  it("skips buttons with missing start attribute", async () => {
    const page = makeMockPage([
      {
        start: null,
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    await expect(clickReserveButton(page as never, slot)).rejects.toThrow(
      "Reserve button not found"
    );
  });

  it("skips buttons with missing courtlabel attribute", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": null,
      },
    ]);

    await expect(clickReserveButton(page as never, slot)).rejects.toThrow(
      "Reserve button not found"
    );
  });

  it("matches on time, date, and court name", async () => {
    const page = makeMockPage([
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #3 Doubles",
      },
      {
        start: "2026-03-20T14:00:00",
        end: "2026-03-20T14:30:00",
        "data-courtlabel": "Court #2 Doubles",
      },
    ]);

    await clickReserveButton(page as never, slot);

    // First button (Court #3) should NOT have been clicked
    expect(page._buttons[0]!.evaluate).not.toHaveBeenCalled();
    // Second button (Court #2) should have been clicked
    expect(page._buttons[1]!.evaluate).toHaveBeenCalledWith(expect.any(Function));
  });
});
