import * as readline from "node:readline/promises";
import type { SlotRequest } from "./types.js";
import { timeToMinutes, minutesToTime } from "./time-utils.js";
import { parseNaturalLanguage } from "./nl-parser.js";

export const OPENING_TIME = "06:00";
export const CLOSING_TIME = "24:00";
export const VALID_DURATIONS = [30, 60, 90, 120] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateDate(dateStr: string): true | string {
  if (!DATE_REGEX.test(dateStr)) {
    return "Invalid date format. Use YYYY-MM-DD";
  }

  const inputDate = new Date(dateStr + "T00:00:00");
  if (isNaN(inputDate.getTime())) {
    return "Invalid date format. Use YYYY-MM-DD";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inputDate < today) {
    return "Date must be today or in the future";
  }

  return true;
}

export function validateStartTime(time: string): true | string {
  if (!TIME_REGEX.test(time)) {
    return "Invalid time format. Use HH:MM (24-hour)";
  }

  const minutes = timeToMinutes(time);
  const openingMinutes = timeToMinutes(OPENING_TIME);
  const closingMinutes = timeToMinutes(CLOSING_TIME);

  if (minutes < openingMinutes) {
    return `Start time must be ${OPENING_TIME} or later`;
  }

  const minDuration = Math.min(...VALID_DURATIONS);
  if (minutes + minDuration > closingMinutes) {
    const latestStart = minutesToTime(closingMinutes - minDuration);
    return `Start time must be ${latestStart} or earlier to fit the shortest booking`;
  }

  return true;
}

export function validateDuration(
  duration: number,
  startTime: string
): true | string {
  if (!VALID_DURATIONS.includes(duration as (typeof VALID_DURATIONS)[number])) {
    return `Duration must be one of: ${VALID_DURATIONS.join(", ")} minutes`;
  }

  const endMinutes = timeToMinutes(startTime) + duration;
  const closingMinutes = timeToMinutes(CLOSING_TIME);

  if (endMinutes > closingMinutes) {
    return `Booking would end after closing time (${CLOSING_TIME})`;
  }

  return true;
}

export function computeEndTime(startTime: string, duration: number): string {
  return minutesToTime(timeToMinutes(startTime) + duration);
}

async function ask(
  rl: readline.Interface,
  question: string,
  validate: (input: string) => true | string,
  defaultValue?: string
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  while (true) {
    const answer = await rl.question(`${question}${suffix}: `);
    const value = answer.trim() || defaultValue || "";
    const result = validate(value);
    if (result === true) return value;
    console.log(`  Error: ${result}`);
  }
}

type MutableSlotRequest = { date?: string; startTime?: string; durationMinutes?: number };
type CliArgs = MutableSlotRequest & { command?: string };

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === "--date" || arg === "-d") && next) {
      result.date = next;
      i++;
    } else if ((arg === "--time" || arg === "-t") && next) {
      result.startTime = next;
      i++;
    } else if ((arg === "--duration" || arg === "-n") && next) {
      result.durationMinutes = parseInt(next, 10);
      i++;
    } else if ((arg === "--command" || arg === "-c") && next) {
      result.command = next;
      i++;
    }
  }

  return result;
}

export async function promptForSlot(): Promise<SlotRequest> {
  const cli = parseCliArgs();

  // Natural language command — parse with LLM
  if (cli.command) {
    console.log("Interpreting command...");
    const parsed = await parseNaturalLanguage(cli.command);
    console.log(`  -> Date: ${parsed.date}, Time: ${parsed.startTime}, Duration: ${parsed.durationMinutes}min`);

    const dateResult = validateDate(parsed.date);
    if (dateResult !== true) throw new Error(`${dateResult} (parsed date: ${parsed.date})`);
    const timeResult = validateStartTime(parsed.startTime);
    if (timeResult !== true) throw new Error(`${timeResult} (parsed time: ${parsed.startTime})`);
    const durResult = validateDuration(parsed.durationMinutes, parsed.startTime);
    if (durResult !== true) throw new Error(`${durResult} (parsed duration: ${parsed.durationMinutes})`);

    return Object.freeze(parsed);
  }

  // If all args provided via CLI, validate and return without prompting
  if (cli.date && cli.startTime && cli.durationMinutes) {
    const dateResult = validateDate(cli.date);
    if (dateResult !== true) throw new Error(dateResult);
    const timeResult = validateStartTime(cli.startTime);
    if (timeResult !== true) throw new Error(timeResult);
    const durResult = validateDuration(cli.durationMinutes, cli.startTime);
    if (durResult !== true) throw new Error(durResult);

    return Object.freeze({
      date: cli.date,
      startTime: cli.startTime,
      durationMinutes: cli.durationMinutes,
    });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const today = new Date().toISOString().split("T")[0]!;

    const date = cli.date ?? await ask(rl, "Date (YYYY-MM-DD)", validateDate, today);

    const startTime = cli.startTime ?? await ask(rl, "Start time (HH:MM, 24-hour)", validateStartTime);

    const validDurations = VALID_DURATIONS.filter(
      (d) => validateDuration(d, startTime) === true
    );

    let durationMinutes: number;
    if (cli.durationMinutes) {
      const durResult = validateDuration(cli.durationMinutes, startTime);
      if (durResult !== true) throw new Error(durResult);
      durationMinutes = cli.durationMinutes;
    } else {
      console.log(`Available durations: ${validDurations.map((d) => `${d}min`).join(", ")}`);
      const durStr = await ask(
        rl,
        "Duration (minutes)",
        (input) => {
          const num = parseInt(input, 10);
          return validateDuration(num, startTime);
        }
      );
      durationMinutes = parseInt(durStr, 10);
    }

    return Object.freeze({
      date,
      startTime,
      durationMinutes,
    });
  } finally {
    rl.close();
  }
}
