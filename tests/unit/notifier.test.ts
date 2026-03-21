import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BookingResult, TimeSlot, Court } from "../../src/types.js";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const mockCourt: Court = {
  id: "court-1",
  name: "Court 1",
  isDoubles: false,
};

const mockSlot: TimeSlot = {
  court: mockCourt,
  startTime: "09:00",
  endTime: "10:00",
  date: "2026-03-20",
  isAvailable: true,
};

const altSlot1: TimeSlot = {
  court: mockCourt,
  startTime: "10:00",
  endTime: "11:00",
  date: "2026-03-20",
  isAvailable: true,
};

const altSlot2: TimeSlot = {
  court: { id: "court-2", name: "Court 2", isDoubles: true },
  startTime: "11:00",
  endTime: "12:00",
  date: "2026-03-20",
  isAvailable: true,
};

describe("notify", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("SUCCESS status", () => {
    it("prints green text with a checkmark", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "success",
        message: "Booking confirmed",
        slot: mockSlot,
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(GREEN);
      expect(output).toContain("✓");
    });

    it("includes court name in output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "success",
        message: "Booking confirmed",
        slot: mockSlot,
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Court 1");
    });

    it("includes date in output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "success",
        message: "Booking confirmed",
        slot: mockSlot,
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("2026-03-20");
    });

    it("includes start and end time in output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "success",
        message: "Booking confirmed",
        slot: mockSlot,
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("09:00");
      expect(output).toContain("10:00");
    });

    it("applies reset code after colored output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "success",
        message: "Booking confirmed",
        slot: mockSlot,
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(RESET);
    });

    it("works without a slot", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "success",
        message: "Booking confirmed",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("✓");
      expect(output).not.toContain("Court");
    });
  });

  describe("ALREADY_BOOKED status", () => {
    it("prints yellow text with a warning symbol", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "already_booked",
        message: "Slot already booked",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(YELLOW);
      expect(output).toContain("⚠");
    });

    it("includes 'already booked' message in output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "already_booked",
        message: "Slot already booked",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output.toLowerCase()).toContain("already booked");
    });

    it("applies reset code after colored output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "already_booked",
        message: "Slot already booked",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(RESET);
    });
  });

  describe("UNAVAILABLE status", () => {
    it("prints red text with an X symbol", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "unavailable",
        message: "No courts available",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(RED);
      expect(output).toContain("✗");
    });

    it("includes unavailable message in output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "unavailable",
        message: "No courts available",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No courts available");
    });

    it("lists alternatives when present", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "unavailable",
        message: "No courts available",
        alternatives: [altSlot1, altSlot2],
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("10:00");
      expect(output).toContain("11:00");
      expect(output).toContain("Court 2");
    });

    it("omits alternatives section when alternatives are not present", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "unavailable",
        message: "No courts available",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output.toLowerCase()).not.toContain("alternative");
    });

    it("omits alternatives section when alternatives array is empty", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "unavailable",
        message: "No courts available",
        alternatives: [],
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output.toLowerCase()).not.toContain("alternative");
    });

    it("applies reset code after colored output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "unavailable",
        message: "No courts available",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(RESET);
    });
  });

  describe("ERROR status", () => {
    it("prints red text with an X symbol", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "error",
        message: "Network timeout",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(RED);
      expect(output).toContain("✗");
    });

    it("includes error message in output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "error",
        message: "Network timeout",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Network timeout");
    });

    it("applies reset code after colored output", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "error",
        message: "Network timeout",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(RESET);
    });

    it("applies bold formatting to the header", async () => {
      const { notify } = await import("../../src/notifier.js");
      const result: BookingResult = {
        status: "error",
        message: "Network timeout",
      };

      notify(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(BOLD);
    });
  });
});
