import type { Page } from "playwright";
import type { TimeSlot } from "../types.js";
import { MY_RESERVATIONS } from "./selectors.js";

const MY_RESERVATIONS_URL =
  "https://app.courtreserve.com/Online/MyReservations/Index/10243";

const COURT_PATTERN = /Court #(\d+)/;
const TIME_PATTERN = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function to24h(time12: string): string {
  const cleaned = time12.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let hours = parseInt(match[1]!, 10);
  const minutes = match[2]!;
  const period = match[3]!.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function cardMatchesDate(cardText: string, targetDate: string): boolean {
  const [yearStr, monthStr, dayStr] = targetDate.split("-");
  if (!yearStr || !monthStr || !dayStr) return false;

  const monthIndex = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const monthAbbrev = MONTH_NAMES[monthIndex];
  if (!monthAbbrev) return false;

  return cardText.includes(monthAbbrev) && cardText.includes(String(day));
}

function parseCard(cardText: string, targetDate: string): TimeSlot | null {
  if (!cardMatchesDate(cardText, targetDate)) return null;

  const courtMatch = cardText.match(COURT_PATTERN);
  if (!courtMatch) return null;

  const timeMatch = cardText.match(TIME_PATTERN);
  if (!timeMatch) return null;

  const courtNum = courtMatch[1]!;
  const startTime = to24h(timeMatch[1]!);
  const endTime = to24h(timeMatch[2]!);

  if (!startTime || !endTime) return null;

  return {
    court: {
      id: courtNum,
      name: `Court #${courtNum}`,
      isDoubles: courtNum !== "1",
    },
    startTime,
    endTime,
    date: targetDate,
    isAvailable: false,
  };
}

export async function getExistingBookings(
  page: Page,
  date: string
): Promise<readonly TimeSlot[]> {
  await page.goto(MY_RESERVATIONS_URL);
  await page.waitForLoadState("networkidle" as never);

  const cards = await page.locator(MY_RESERVATIONS.BOOKING_CARD).all();

  const bookings: TimeSlot[] = [];
  for (const card of cards) {
    const text = await card.textContent();
    if (!text) continue;
    const parsed = parseCard(text, date);
    if (parsed) {
      bookings.push(parsed);
    }
  }

  return Object.freeze(bookings);
}
