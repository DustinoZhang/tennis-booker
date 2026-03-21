/**
 * CourtReserve allows booking up to exactly 7 days in advance.
 * A slot at time T on date D becomes bookable at time T on date D-7.
 *
 * If the requested slot's booking window hasn't opened yet, this module
 * calculates when it opens and waits until just before that moment so
 * we can grab the court the instant it becomes available.
 */

const BOOKING_WINDOW_DAYS = 7;
/** How many seconds before the window opens to launch browser + login */
const LEAD_TIME_SECONDS = 30;

/**
 * Given a slot's date and start time, returns the Date when that slot
 * becomes bookable (exactly 7 days before the slot).
 */
export function getBookingWindowOpen(
  slotDate: string,
  slotTime: string
): Date {
  // slotDate: "YYYY-MM-DD", slotTime: "HH:MM"
  const slotDateTime = new Date(`${slotDate}T${slotTime}:00`);
  const windowOpen = new Date(
    slotDateTime.getTime() - BOOKING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  return windowOpen;
}

/**
 * Calculate how many milliseconds to wait before attempting to book.
 * Returns 0 if the window is already open.
 * Returns a positive value if we need to wait (fires LEAD_TIME_SECONDS early).
 */
export function getWaitMs(slotDate: string, slotTime: string): number {
  const windowOpen = getBookingWindowOpen(slotDate, slotTime);
  const now = new Date();

  // Target = window open minus lead time (so we're ready the instant it opens)
  const targetTime = windowOpen.getTime() - LEAD_TIME_SECONDS * 1000;
  const waitMs = targetTime - now.getTime();

  return Math.max(0, waitMs);
}

/**
 * Returns true if the slot's booking window is not yet open.
 */
export function needsToWait(slotDate: string, slotTime: string): boolean {
  return getWaitMs(slotDate, slotTime) > 0;
}

/**
 * Format a duration in ms as a human-readable countdown string.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Wait until the booking window opens, printing countdown updates.
 * Resolves when it's time to book (LEAD_TIME_SECONDS before window opens).
 */
export async function waitForBookingWindow(
  slotDate: string,
  slotTime: string
): Promise<void> {
  const windowOpen = getBookingWindowOpen(slotDate, slotTime);
  const waitMs = getWaitMs(slotDate, slotTime);

  if (waitMs <= 0) return;

  console.log(
    `\nBooking window for ${slotDate} ${slotTime} opens at: ` +
      `${windowOpen.toLocaleString()}`
  );
  console.log(
    `Waiting until ${LEAD_TIME_SECONDS}s before window opens ` +
      `(${formatCountdown(waitMs)} from now)...\n`
  );

  // Update countdown every 30 seconds for long waits, every 5s for short waits
  const startTime = Date.now();
  const endTime = startTime + waitMs;

  while (Date.now() < endTime) {
    const remaining = endTime - Date.now();
    if (remaining <= 0) break;

    const interval =
      remaining > 5 * 60 * 1000
        ? 30_000 // >5 min: update every 30s
        : remaining > 60_000
          ? 10_000 // >1 min: update every 10s
          : 1_000; // <1 min: update every 1s

    const sleepTime = Math.min(interval, remaining);
    await new Promise((resolve) => setTimeout(resolve, sleepTime));

    const nowRemaining = endTime - Date.now();
    if (nowRemaining > 0) {
      process.stdout.write(
        `\r  Booking window opens in ${formatCountdown(nowRemaining)}   `
      );
    }
  }

  // Clear the countdown line
  process.stdout.write("\r  Launching browser...                           \n\n");
}

/**
 * After browser is launched, logged in, and on the grid page, wait for the
 * exact moment the booking window opens before clicking Reserve.
 * This is a tight spin-wait for precision — should only last a few seconds.
 */
export async function waitForExactWindowOpen(
  slotDate: string,
  slotTime: string
): Promise<void> {
  const windowOpen = getBookingWindowOpen(slotDate, slotTime);
  const targetMs = windowOpen.getTime();

  const remaining = targetMs - Date.now();
  if (remaining <= 0) return;

  console.log(
    `  Ready. Waiting ${formatCountdown(remaining)} for window to open...`
  );

  // Tight loop for the final wait — poll every 200ms for precision
  while (Date.now() < targetMs) {
    const left = targetMs - Date.now();
    if (left <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(200, left)));
  }

  console.log("  Window open — booking now!\n");
}
