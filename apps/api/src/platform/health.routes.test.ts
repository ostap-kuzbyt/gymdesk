import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "./config.js";

const app = buildApp(loadConfig({ NODE_ENV: "test", DATABASE_URL: "postgres://localhost/test" }));

afterEach(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("reports the service as ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", uptimeSeconds: expect.any(Number) });
  });
});
