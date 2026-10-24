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

  it("rejects an unreasonable reminder window or discount", () => {
    expect(() => loadConfig({ ...required, REMINDER_DAYS_BEFORE: "0" })).toThrow(/REMINDER/);
    expect(() => loadConfig({ ...required, PROMO_DISCOUNT_PERCENT: "95" })).toThrow(/PROMO/);
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
