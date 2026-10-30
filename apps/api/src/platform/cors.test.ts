import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { testConfig } from "../testing/test-config.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const WEB = "https://gymdesk.vercel.app";

describe("cross-origin requests", () => {
  it("are not enabled unless an origin is configured", async () => {
    app = buildApp(testConfig());

    const response = await app.inject({ method: "GET", url: "/health", headers: { origin: WEB } });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("let a configured web origin read the api", async () => {
    app = buildApp(testConfig({ CORS_ORIGIN: WEB }));

    const response = await app.inject({ method: "GET", url: "/health", headers: { origin: WEB } });

    expect(response.headers["access-control-allow-origin"]).toBe(WEB);
  });

  it("answer a preflight for a bearer token request", async () => {
    app = buildApp(testConfig({ CORS_ORIGIN: WEB }));

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/members",
      headers: {
        origin: WEB,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(WEB);
    expect(response.headers["access-control-allow-headers"]).toContain("authorization");
  });

  it("stay closed to every other origin", async () => {
    app = buildApp(testConfig({ CORS_ORIGIN: WEB }));

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
