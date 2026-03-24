import { createServer } from "node:http";
import { once } from "node:events";
import { exec } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, access } from "node:fs/promises";
import { google } from "googleapis";
import { computeEndTime } from "./prompts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = join(__dirname, "..", ".google-tokens.json");
const CALENDAR_NAME = "NYC TENNIS";
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"];

type StoredTokens = {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: string;
  readonly expiry_date: number;
};

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for calendar integration. " +
        "Set up OAuth credentials at https://console.cloud.google.com/apis/credentials"
    );
  }

  return { clientId, clientSecret };
}

function createOAuth2Client(redirectUri?: string) {
  const { clientId, clientSecret } = getClientCredentials();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function loadTokens(): Promise<StoredTokens> {
  const data = await readFile(TOKEN_PATH, "utf-8");
  return JSON.parse(data) as StoredTokens;
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

/**
 * Check whether saved Google OAuth tokens exist.
 */
export async function hasGoogleAuth(): Promise<boolean> {
  try {
    await access(TOKEN_PATH);
    const tokens = await loadTokens();
    return Boolean(tokens.refresh_token);
  } catch {
    return false;
  }
}

/**
 * One-time interactive OAuth flow. Opens the user's browser for consent,
 * receives the callback on a local server, and saves tokens to disk.
 */
export async function authorizeGoogle(): Promise<void> {
  // Start a temporary local server to receive the OAuth callback
  const server = createServer();
  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to start local OAuth callback server");
  }

  const port = address.port;
  const redirectUri = `http://localhost:${port}`;
  const oauth2Client = createOAuth2Client(redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("Opening browser for Google authorization...");
  console.log(`If the browser doesn't open, visit: ${authUrl}\n`);

  // Wait for the OAuth callback
  const codePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("OAuth authorization timed out after 2 minutes"));
    }, 120_000);

    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorization denied.</h2><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth authorization denied: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorization successful!</h2><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        resolve(code);
      }
    });
  });

  exec(`open "${authUrl}"`);
  const code = await codePromise;

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Revoke app access at https://myaccount.google.com/permissions and try again.");
  }

  await saveTokens({
    access_token: tokens.access_token ?? "",
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type ?? "Bearer",
    expiry_date: tokens.expiry_date ?? 0,
  });

  console.log("Google Calendar authorization saved successfully.");
}

/**
 * Create a Google Calendar event for a booked tennis slot.
 * Returns the event's HTML link, or throws on failure.
 */
export async function createCalendarEvent(
  slot: { readonly court: { readonly name: string }; readonly date: string; readonly startTime: string },
  durationMinutes: number
): Promise<string> {
  const tokens = await loadTokens();
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Refresh token if expired and save updated tokens
  oauth2Client.on("tokens", (newTokens) => {
    const updated: StoredTokens = {
      access_token: newTokens.access_token ?? tokens.access_token,
      refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
      token_type: newTokens.token_type ?? tokens.token_type,
      expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
    };
    void saveTokens(updated);
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Find the "NYC TENNIS" calendar by name
  const calendarList = await calendar.calendarList.list();
  const targetCalendar = calendarList.data.items?.find(
    (cal) => cal.summary === CALENDAR_NAME
  );

  if (!targetCalendar?.id) {
    throw new Error(
      `Calendar "${CALENDAR_NAME}" not found. Available calendars: ` +
        (calendarList.data.items?.map((c) => c.summary).join(", ") ?? "none")
    );
  }

  // Build event times
  const startDateTime = `${slot.date}T${slot.startTime}:00`;
  const endTime = computeEndTime(slot.startTime, durationMinutes);
  const endDateTime = `${slot.date}T${endTime}:00`;

  const event = await calendar.events.insert({
    calendarId: targetCalendar.id,
    requestBody: {
      summary: `Tennis - ${slot.court.name}`,
      start: { dateTime: startDateTime, timeZone: "America/New_York" },
      end: { dateTime: endDateTime, timeZone: "America/New_York" },
      location: "CourtReserve",
    },
  });

  return event.data.htmlLink ?? "Event created (no link available)";
}

// Allow running directly for auth or test
const cliMode = process.argv.includes("--auth")
  ? "auth"
  : process.argv.includes("--test")
    ? "test"
    : null;

if (cliMode) {
  (async () => {
    const { config } = await import("dotenv");
    config();

    if (cliMode === "auth") {
      await authorizeGoogle();
      return;
    }

    // --test: create a test event, print the link, then delete it
    console.log("Testing Google Calendar integration...\n");

    if (!(await hasGoogleAuth())) {
      throw new Error("Not authorized. Run `npm run auth:google` first.");
    }

    const tokens = await loadTokens();
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Find calendar
    const calendarList = await calendar.calendarList.list();
    const targetCalendar = calendarList.data.items?.find(
      (cal) => cal.summary === CALENDAR_NAME
    );

    if (!targetCalendar?.id) {
      throw new Error(
        `Calendar "${CALENDAR_NAME}" not found. Available calendars: ` +
          (calendarList.data.items?.map((c) => c.summary).join(", ") ?? "none")
      );
    }

    console.log(`Found calendar: ${CALENDAR_NAME} (${targetCalendar.id})`);

    // Create test event 1 hour from now
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const event = await calendar.events.insert({
      calendarId: targetCalendar.id,
      requestBody: {
        summary: "Tennis Booker - TEST EVENT (will be deleted)",
        start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
        end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
        location: "CourtReserve",
      },
    });

    console.log(`Event created: ${event.data.htmlLink}`);
    console.log(`Event ID: ${event.data.id}`);

    // Delete it
    await calendar.events.delete({
      calendarId: targetCalendar.id,
      eventId: event.data.id!,
    });

    console.log("Event deleted. Calendar integration is working!");
  })().catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
