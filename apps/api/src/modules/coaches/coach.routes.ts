import { coachChanges, coachView, id, newCoach } from "@gymdesk/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import type { CoachSnapshot } from "./coach.js";
import type { CoachService } from "./coach.service.js";

export interface CoachRoutesOptions {
  service: CoachService;
  requireRole: RoleGuard;
}

const idParams = z.object({ id });

function forReader(request: FastifyRequest, coach: CoachSnapshot): CoachSnapshot {
  return request.auth?.roles.includes("admin") ? coach : { ...coach, authSubject: null };
}

export const coachRoutes: FastifyPluginAsync<CoachRoutesOptions> = async (
  app,
  { service, requireRole },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const anyStaff = requireRole("admin", "reception", "coach");
  const admin = requireRole("admin");

  api.get(
    "/api/coaches",
    {
      preHandler: anyStaff,
      schema: {
        querystring: z.object({ includeArchived: z.stringbool().default(false) }),
        response: { 200: z.array(coachView) },
      },
    },
    async (request) =>
      (await service.list({ includeArchived: request.query.includeArchived })).map((coach) =>
        forReader(request, coach),
      ),
  );

  api.get(
    "/api/coaches/:id",
    { preHandler: anyStaff, schema: { params: idParams, response: { 200: coachView } } },
    async (request) => forReader(request, await service.get(request.params.id)),
  );

  api.post(
    "/api/coaches",
    { preHandler: admin, schema: { body: newCoach, response: { 201: coachView } } },
    async (request, reply) => reply.code(201).send(await service.create(request.body)),
  );

  api.patch(
    "/api/coaches/:id",
    {
      preHandler: admin,
      schema: { params: idParams, body: coachChanges, response: { 200: coachView } },
    },
    async (request) => {
      const { version, ...changes } = request.body;
      return service.update(request.params.id, version, changes);
    },
  );

  api.post(
    "/api/coaches/:id/archive",
    { preHandler: admin, schema: { params: idParams, response: { 200: coachView } } },
    async (request) => service.archive(request.params.id),
  );
};
