import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const required = {
  DATABASE_URL: "postgres://localhost/gymdesk",
  AUTH0_DOMAIN: "tenant.eu.auth0.com",
  AUTH0_AUDIENCE: "https://api.gymdesk",
  AUTH0_ROLES_CLAIM: "https://gymdesk/roles",
};

describe("loadConfig", () => {
  it("applies defaults for optional values", () => {
    const config = loadConfig(required);

    expect(config).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
      LOG_LEVEL: "info",
      CLUB_TIMEZONE: "Europe/Kyiv",
    });
  });

  it.each(Object.keys(required))("requires %s", (key) => {
    const env: Record<string, string> = { ...required };
    delete env[key];

    expect(() => loadConfig(env)).toThrow(new RegExp(key));
  });

  it("rejects an unknown time zone", () => {
    expect(() => loadConfig({ ...required, CLUB_TIMEZONE: "Mars/Olympus" })).toThrow(
      /CLUB_TIMEZONE/,
    );
  });

  it("rejects an out-of-range port", () => {
    expect(() => loadConfig({ ...required, PORT: "70000" })).toThrow(/PORT/);
  });
});
