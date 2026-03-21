import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, type Config } from "../../src/config.js";

describe("loadConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a valid config when all env vars are set", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");
    vi.stubEnv("DEBUG", "false");

    const config = loadConfig();

    expect(config).toEqual({
      username: "user@example.com",
      password: "secret123",
      debug: false,
      baseUrl:
        "https://app.courtreserve.com/Online/Reservations/Index/10243",
    } satisfies Config);
  });

  it("parses DEBUG=true as boolean true", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");
    vi.stubEnv("DEBUG", "true");

    const config = loadConfig();

    expect(config.debug).toBe(true);
  });

  it("defaults DEBUG to false when not set", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");
    vi.stubEnv("DEBUG", "");

    const config = loadConfig();

    expect(config.debug).toBe(false);
  });

  it("parses DEBUG=1 as boolean true", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");
    vi.stubEnv("DEBUG", "1");

    const config = loadConfig();

    expect(config.debug).toBe(true);
  });

  it("throws when COURTRESERVE_USERNAME is missing", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");

    expect(() => loadConfig()).toThrow("COURTRESERVE_USERNAME");
  });

  it("throws when COURTRESERVE_PASSWORD is missing", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "");

    expect(() => loadConfig()).toThrow("COURTRESERVE_PASSWORD");
  });

  it("throws when COURTRESERVE_USERNAME is empty string", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");

    expect(() => loadConfig()).toThrow("COURTRESERVE_USERNAME");
  });

  it("throws when COURTRESERVE_PASSWORD is empty string", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "");

    expect(() => loadConfig()).toThrow("COURTRESERVE_PASSWORD");
  });

  it("returns a frozen object that cannot be mutated", () => {
    vi.stubEnv("COURTRESERVE_USERNAME", "user@example.com");
    vi.stubEnv("COURTRESERVE_PASSWORD", "secret123");

    const config = loadConfig();

    expect(() => {
      (config as Record<string, unknown>)["username"] = "hacked";
    }).toThrow();
  });
});
