import Anthropic from "@anthropic-ai/sdk";

type ParsedSlot = {
  readonly date: string;
  readonly startTime: string;
  readonly durationMinutes: number;
};

export async function parseNaturalLanguage(
  command: string
): Promise<ParsedSlot> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for --command"
    );
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Today is ${dayOfWeek}, ${todayStr}. Extract booking details from this request and return ONLY valid JSON, no other text:

"${command}"

Return JSON: {"date": "YYYY-MM-DD", "startTime": "HH:MM" (24h), "durationMinutes": number}

Rules:
- "this coming Thursday" means the next Thursday from today
- "11pm" = "23:00", "7am" = "07:00"
- "1 hour" = 60, "90 minutes" = 90, "half hour" = 30
- Default duration is 60 if not specified
- Only return the JSON object, nothing else`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[^}]+\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse booking request: "${command}"`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  if (
    typeof parsed.date !== "string" ||
    typeof parsed.startTime !== "string" ||
    typeof parsed.durationMinutes !== "number"
  ) {
    throw new Error(`Invalid response from LLM: ${jsonMatch[0]}`);
  }

  return {
    date: parsed.date,
    startTime: parsed.startTime,
    durationMinutes: parsed.durationMinutes,
  };
}
