import { generateKeyPair, SignJWT } from "jose";
import type { CryptoKey } from "jose";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenVerifier, registerAuth } from "./auth.js";
import { registerErrorHandler } from "./errors.js";
import { testAuth } from "../testing/test-config.js";

let app: FastifyInstance;
let privateKey: CryptoKey;
let foreignKey: CryptoKey;

interface TokenOptions {
  key?: CryptoKey;
  subject?: string;
  roles?: unknown;
  issuer?: string;
  audience?: string;
  expiresAt?: number;
}

function sign(options: TokenOptions = {}): Promise<string> {
  const expiresAt = options.expiresAt ?? Math.floor(Date.now() / 1000) + 300;
  return new SignJWT({ [testAuth.rolesClaim]: options.roles ?? ["admin"] })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(options.subject ?? "auth0|member-1")
    .setIssuer(options.issuer ?? testAuth.issuer)
    .setAudience(options.audience ?? testAuth.audience)
    .setExpirationTime(expiresAt)
    .sign(options.key ?? privateKey);
}

function get(url: string, token?: string) {
  return app.inject({
    method: "GET",
    url,
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  });
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  foreignKey = (await generateKeyPair("RS256")).privateKey;

  app = Fastify();
  registerErrorHandler(app);
  const requireRole = registerAuth(
    app,
    createTokenVerifier({ ...testAuth, keys: async () => pair.publicKey }),
  );

  app.get("/staff", { preHandler: requireRole("admin", "reception") }, async (request) => ({
    subject: request.auth?.subject,
    roles: request.auth?.roles,
  }));
});

afterAll(async () => {
  await app.close();
});

describe("role guard", () => {
  it("lets a token with an allowed role through and exposes the caller", async () => {
    const response = await get("/staff", await sign({ roles: ["reception"] }));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ subject: "auth0|member-1", roles: ["reception"] });
  });

  it("answers 401 without an authorization header", async () => {
    const response = await get("/staff");

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it.each([
    ["is not a jwt", async () => "not-a-token"],
    ["is signed with another key", () => sign({ key: foreignKey })],
    ["has expired", () => sign({ expiresAt: Math.floor(Date.now() / 1000) - 60 })],
    ["has the wrong audience", () => sign({ audience: "https://someone-else" })],
    ["has the wrong issuer", () => sign({ issuer: "https://evil.example/" })],
  ])("answers 401 when the token %s", async (_label, makeToken) => {
    const response = await get("/staff", await makeToken());

    expect(response.statusCode).toBe(401);
  });

  it("answers 403 when the role is not allowed", async () => {
    const response = await get("/staff", await sign({ roles: ["coach"] }));

    expect(response.statusCode).toBe(403);
  });

  it("answers 403 when the token has no roles claim or only unknown roles", async () => {
    expect((await get("/staff", await sign({ roles: "admin" }))).statusCode).toBe(403);
    expect((await get("/staff", await sign({ roles: ["superuser"] }))).statusCode).toBe(403);
  });

  it("ignores unknown roles next to known ones", async () => {
    const response = await get("/staff", await sign({ roles: ["superuser", "admin"] }));

    expect(response.json()).toMatchObject({ roles: ["admin"] });
  });
});
