import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("applies defaults for optional values", () => {
    const config = loadConfig({ DATABASE_URL: "postgres://localhost/gymdesk" });

    expect(config).toMatchObject({ NODE_ENV: "development", PORT: 3000, LOG_LEVEL: "info" });
  });

  it("requires a database url", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an out-of-range port", () => {
    expect(() =>
      loadConfig({ DATABASE_URL: "postgres://localhost/gymdesk", PORT: "70000" }),
    ).toThrow(/PORT/);
  });
});
