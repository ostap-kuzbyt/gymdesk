import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "../app.js";
import { loadConfig } from "./config.js";
import { ConflictError, DomainError, NotFoundError } from "./errors.js";

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp(loadConfig({ NODE_ENV: "test", DATABASE_URL: "postgres://localhost/test" }));
  app.get("/domain", async () => {
    throw new DomainError("Subscription has already expired");
  });
  app.get("/missing", async () => {
    throw new NotFoundError("Member was not found");
  });
  app.get("/conflict", async () => {
    throw new ConflictError("Member was changed by someone else");
  });
  app.get("/crash", async () => {
    throw new Error("connection string leaked here");
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      "/echo",
      { schema: { body: z.object({ name: z.string().min(2) }) } },
      async (request) => request.body,
    );
});

afterEach(async () => {
  await app.close();
});

describe("error handler", () => {
  it.each([
    ["/domain", 400, "Subscription has already expired"],
    ["/missing", 404, "Member was not found"],
    ["/conflict", 409, "Member was changed by someone else"],
  ])("maps %s to %i with its own message", async (url, status, detail) => {
    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status, detail });
  });

  it("hides the details of unexpected errors", async () => {
    const response = await app.inject({ method: "GET", url: "/crash" });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("connection string");
    expect(response.json()).toMatchObject({
      status: 500,
      detail: "An unexpected error occurred",
    });
  });

  it("lists every invalid field on a validation failure", async () => {
    const response = await app.inject({ method: "POST", url: "/echo", payload: { name: "a" } });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toEqual([{ path: "name", message: expect.any(String) }]);
  });

  it("answers unknown routes with a problem document", async () => {
    const response = await app.inject({ method: "GET", url: "/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toContain("/nope");
  });

  it("rejects malformed JSON with a 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/echo",
      headers: { "content-type": "application/json" },
      payload: "{broken",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });
});
