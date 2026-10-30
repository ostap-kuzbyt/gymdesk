import { meView } from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { RoleGuard } from "./auth.js";
import type { CoachLookup } from "./scope.js";

export interface MeRoutesOptions {
  requireRole: RoleGuard;
  coachIdOf: CoachLookup;
}

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (
  app,
  { requireRole, coachIdOf },
) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/me",
    {
      preHandler: requireRole("admin", "reception", "coach"),
      schema: { response: { 200: meView } },
    },
    async (request) => {
      const auth = request.auth;
      if (!auth) throw new Error("The request was not authenticated");
      return { subject: auth.subject, roles: auth.roles, coachId: await coachIdOf(auth.subject) };
    },
  );
};
