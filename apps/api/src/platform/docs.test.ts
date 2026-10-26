import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { testConfig } from "../testing/test-config.js";
import { summaryFor } from "./docs.js";

interface Operation {
  tags?: string[];
  summary?: string;
  security?: unknown[];
  requestBody?: { content: Record<string, { schema: { properties?: Record<string, unknown> } }> };
  responses?: Record<string, unknown>;
  parameters?: { name: string; in: string }[];
}

interface Spec {
  openapi: string;
  info: { title: string; version: string };
  security: unknown[];
  components: { securitySchemes: Record<string, unknown> };
  paths: Record<string, Record<string, Operation>>;
}

let app: FastifyInstance;
let spec: Spec;

beforeAll(async () => {
  app = buildApp(testConfig({ CLUB_NAME: "Iron Works" }));
  await app.ready();
  const response = await app.inject({ method: "GET", url: "/docs/openapi.json" });
  spec = response.json() as Spec;
});

afterAll(async () => {
  await app.close();
});

const operations = () =>
  Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({
      path,
      method: method.toUpperCase(),
      operation,
    })),
  );

describe("OpenAPI document", () => {
  it("describes the club's API and requires a bearer token by default", () => {
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(spec.info).toMatchObject({ title: "Iron Works API", version: "0.1.0" });
    expect(spec.components.securitySchemes).toMatchObject({
      bearerAuth: { type: "http", scheme: "bearer" },
    });
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documents every endpoint of the API", () => {
    const documented = operations().map(({ method, path }) => `${method} ${path}`);

    expect(documented).toEqual(
      expect.arrayContaining([
        "GET /health",
        "POST /api/tariffs",
        "GET /api/studios/{id}",
        "PUT /api/members/{id}/coach",
        "POST /api/members/{id}/check-ins",
        "POST /api/workouts/{id}/reservations",
        "POST /api/reminders/scan",
        "GET /api/reports/revenue",
        "GET /api/coaches/{id}/members",
      ]),
    );
    expect(operations().filter(({ path }) => path.startsWith("/api"))).toHaveLength(39);
  });

  it("gives every endpoint a tag and a summary", () => {
    for (const { method, path, operation } of operations()) {
      expect(operation.tags?.length, `${method} ${path} has no tag`).toBe(1);
      expect(operation.summary, `${method} ${path} has no summary`).toBeTruthy();
    }
  });

  it("keeps the summary table in sync with the registered routes", () => {
    for (const { method, path } of operations()) {
      const fastifyPath = path.replaceAll(/\{(\w+)\}/g, ":$1");
      expect(summaryFor(method, fastifyPath), `${method} ${path}`).toBeDefined();
    }
  });

  it("leaves the health check public", () => {
    expect(spec.paths["/health"]?.get?.security).toEqual([]);
    expect(spec.paths["/api/tariffs"]?.get?.security).toBeUndefined();
  });

  it("derives request and response schemas from the zod definitions", () => {
    const create = spec.paths["/api/tariffs"]?.post;
    const body = create?.requestBody?.content["application/json"]?.schema.properties;

    expect(Object.keys(body ?? {})).toEqual(
      expect.arrayContaining(["name", "priceCents", "durationDays", "visitLimit"]),
    );
    expect(Object.keys(create?.responses ?? {})).toEqual(expect.arrayContaining(["201"]));
    expect(
      spec.paths["/api/workouts"]?.get?.parameters?.map((parameter) => parameter.name),
    ).toEqual(expect.arrayContaining(["from", "to", "studioId", "coachId", "includeCancelled"]));
  });
});

describe("API reference page", () => {
  it("redirects /docs to the reference page and serves it", async () => {
    const redirect = await app.inject({ method: "GET", url: "/docs" });
    expect(redirect.statusCode).toBe(301);

    const response = await app.inject({ method: "GET", url: String(redirect.headers.location) });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Iron Works API reference");
  });
});
