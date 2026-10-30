import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { ForbiddenError } from "./errors.js";
import { assertOwnedBy, createScopeResolver } from "./scope.js";

function requestOf(roles: ("admin" | "reception" | "coach")[], subject = "auth0|someone") {
  return { auth: { subject, roles } } as unknown as FastifyRequest;
}

const lookup = async (subject: string) => (subject === "auth0|linked" ? "coach-1" : null);

describe("createScopeResolver", () => {
  it("gives admins and reception the whole club without a lookup", async () => {
    const resolve = createScopeResolver(async () => {
      throw new Error("no lookup expected");
    });

    expect(await resolve(requestOf(["admin"]))).toEqual({ kind: "club" });
    expect(await resolve(requestOf(["reception"]))).toEqual({ kind: "club" });
    expect(await resolve(requestOf(["coach", "reception"]))).toEqual({ kind: "club" });
  });

  it("scopes a coach to the profile linked to their account", async () => {
    const resolve = createScopeResolver(lookup);

    expect(await resolve(requestOf(["coach"], "auth0|linked"))).toEqual({
      kind: "coach",
      coachId: "coach-1",
    });
    expect(await resolve(requestOf(["coach"], "auth0|other"))).toEqual({
      kind: "coach",
      coachId: null,
    });
  });
});

describe("assertOwnedBy", () => {
  it("lets the club see everything", () => {
    expect(() => assertOwnedBy({ kind: "club" }, "coach-9")).not.toThrow();
    expect(() => assertOwnedBy({ kind: "club" }, null)).not.toThrow();
  });

  it("lets a coach see only their own records", () => {
    const scope = { kind: "coach", coachId: "coach-1" } as const;

    expect(() => assertOwnedBy(scope, "coach-1")).not.toThrow();
    expect(() => assertOwnedBy(scope, "coach-2")).toThrow(ForbiddenError);
    expect(() => assertOwnedBy(scope, null)).toThrow(ForbiddenError);
  });

  it("refuses an unlinked coach everything, including records without an owner", () => {
    const scope = { kind: "coach", coachId: null } as const;

    expect(() => assertOwnedBy(scope, null)).toThrow(ForbiddenError);
    expect(() => assertOwnedBy(scope, "coach-1")).toThrow(ForbiddenError);
  });
});
