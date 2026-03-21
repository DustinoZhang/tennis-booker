import { z } from "zod";

const BASE_URL =
  "https://app.courtreserve.com/Online/Reservations/Index/10243";

const configSchema = z.object({
  COURTRESERVE_USERNAME: z.string().min(1, "COURTRESERVE_USERNAME is required"),
  COURTRESERVE_PASSWORD: z.string().min(1, "COURTRESERVE_PASSWORD is required"),
  DEBUG: z.string().optional(),
});

export type Config = {
  readonly username: string;
  readonly password: string;
  readonly debug: boolean;
  readonly baseUrl: string;
};

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid configuration: ${issues}`);
  }

  const config: Config = {
    username: result.data.COURTRESERVE_USERNAME,
    password: result.data.COURTRESERVE_PASSWORD,
    debug: result.data.DEBUG === "true" || result.data.DEBUG === "1",
    baseUrl: BASE_URL,
  };

  return Object.freeze(config);
}
