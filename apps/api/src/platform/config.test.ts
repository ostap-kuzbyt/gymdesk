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

  it("defaults the club name, reminder window and promotion size", () => {
    expect(loadConfig(required)).toMatchObject({
      CLUB_NAME: "Gymdesk",
      REMINDER_DAYS_BEFORE: 7,
      PROMO_DISCOUNT_PERCENT: 10,
    });
  });

  it("treats blank mail settings as not configured", () => {
    const config = loadConfig({ ...required, SENDGRID_API_KEY: "", MAIL_FROM: " " });

    expect(config.SENDGRID_API_KEY).toBeUndefined();
    expect(config.MAIL_FROM).toBeUndefined();
  });

  it("requires a sender address once an api key is set", () => {
    expect(() => loadConfig({ ...required, SENDGRID_API_KEY: "SG.key" })).toThrow(/MAIL_FROM/);
    expect(() =>
      loadConfig({ ...required, SENDGRID_API_KEY: "SG.key", MAIL_FROM: "not-an-email" }),
    ).toThrow(/MAIL_FROM/);
    expect(
      loadConfig({ ...required, SENDGRID_API_KEY: "SG.key", MAIL_FROM: "club@example.com" })
        .MAIL_FROM,
    ).toBe("club@example.com");
  });

  it("has no allowed origins unless CORS_ORIGIN is set", () => {
    expect(loadConfig(required).CORS_ORIGIN).toEqual([]);
    expect(loadConfig({ ...required, CORS_ORIGIN: "  " }).CORS_ORIGIN).toEqual([]);
  });

  it("reads a comma-separated list of origins", () => {
    expect(
      loadConfig({
        ...required,
        CORS_ORIGIN: "https://gymdesk.vercel.app, http://localhost:5173",
      }).CORS_ORIGIN,
    ).toEqual(["https://gymdesk.vercel.app", "http://localhost:5173"]);
  });

  it("rejects origins with a path, a trailing slash or no scheme", () => {
    for (const bad of [
      "gymdesk.vercel.app",
      "https://gymdesk.vercel.app/",
      "https://a.app/path",
      "*",
    ]) {
      expect(() => loadConfig({ ...required, CORS_ORIGIN: bad })).toThrow(/CORS_ORIGIN/);
    }
  });

  it("rejects an unreasonable reminder window or discount", () => {
    expect(() => loadConfig({ ...required, REMINDER_DAYS_BEFORE: "0" })).toThrow(/REMINDER/);
    expect(() => loadConfig({ ...required, PROMO_DISCOUNT_PERCENT: "95" })).toThrow(/PROMO/);
  });

  it("runs background jobs at 08:00 by default and accepts overrides", () => {
    expect(loadConfig(required)).toMatchObject({ RUN_JOBS: true, EXPIRY_SCAN_CRON: "0 8 * * *" });
    expect(
      loadConfig({ ...required, RUN_JOBS: "false", EXPIRY_SCAN_CRON: "30 6 * * 1-5" }),
    ).toMatchObject({
      RUN_JOBS: false,
      EXPIRY_SCAN_CRON: "30 6 * * 1-5",
    });
  });

  it("applies migrations on start only when asked to", () => {
    expect(loadConfig(required).MIGRATE_ON_START).toBe(false);
    expect(loadConfig({ ...required, MIGRATE_ON_START: "true" }).MIGRATE_ON_START).toBe(true);
  });

  it("rejects a cron expression that does not have five fields", () => {
    expect(() => loadConfig({ ...required, EXPIRY_SCAN_CRON: "every morning" })).toThrow(
      /EXPIRY_SCAN_CRON/,
    );
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
