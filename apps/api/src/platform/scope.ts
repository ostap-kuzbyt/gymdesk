import type { FastifyRequest } from "fastify";
import { ForbiddenError } from "./errors.js";

export type StaffScope = { kind: "club" } | { kind: "coach"; coachId: string | null };

export type ScopeResolver = (request: FastifyRequest) => Promise<StaffScope>;

export type CoachLookup = (subject: string) => Promise<string | null>;

export function createScopeResolver(coachIdOf: CoachLookup): ScopeResolver {
  return async (request) => {
    const auth = request.auth;
    if (!auth || auth.roles.includes("admin") || auth.roles.includes("reception")) {
      return { kind: "club" };
    }
    return { kind: "coach", coachId: await coachIdOf(auth.subject) };
  };
}

export function assertOwnedBy(scope: StaffScope, coachId: string | null): void {
  if (scope.kind === "club") return;
  if (scope.coachId === null || scope.coachId !== coachId) {
    throw new ForbiddenError("This record belongs to another coach");
  }
}
