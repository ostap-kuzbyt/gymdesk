import { id, newStudio, studioChanges, studioView } from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import type { StudioService } from "./studio.service.js";

export interface StudioRoutesOptions {
  service: StudioService;
  requireRole: RoleGuard;
}

const idParams = z.object({ id });

export const studioRoutes: FastifyPluginAsync<StudioRoutesOptions> = async (
  app,
  { service, requireRole },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const anyStaff = requireRole("admin", "reception", "coach");
  const admin = requireRole("admin");

  api.get(
    "/api/studios",
    {
      preHandler: anyStaff,
      schema: {
        querystring: z.object({ includeArchived: z.stringbool().default(false) }),
        response: { 200: z.array(studioView) },
      },
    },
    async (request) => service.list({ includeArchived: request.query.includeArchived }),
  );

  api.get(
    "/api/studios/:id",
    {
      preHandler: anyStaff,
      schema: { params: idParams, response: { 200: studioView } },
    },
    async (request) => service.get(request.params.id),
  );

  api.post(
    "/api/studios",
    {
      preHandler: admin,
      schema: { body: newStudio, response: { 201: studioView } },
    },
    async (request, reply) => reply.code(201).send(await service.create(request.body)),
  );

  api.patch(
    "/api/studios/:id",
    {
      preHandler: admin,
      schema: { params: idParams, body: studioChanges, response: { 200: studioView } },
    },
    async (request) => {
      const { version, ...changes } = request.body;
      return service.update(request.params.id, version, changes);
    },
  );

  api.post(
    "/api/studios/:id/archive",
    {
      preHandler: admin,
      schema: { params: idParams, response: { 200: studioView } },
    },
    async (request) => service.archive(request.params.id),
  );
};
