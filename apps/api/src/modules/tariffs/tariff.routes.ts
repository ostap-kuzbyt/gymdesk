import { id, newTariff, tariffChanges, tariffView } from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import type { TariffService } from "./tariff.service.js";

export interface TariffRoutesOptions {
  service: TariffService;
  requireRole: RoleGuard;
}

const idParams = z.object({ id });

export const tariffRoutes: FastifyPluginAsync<TariffRoutesOptions> = async (
  app,
  { service, requireRole },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const anyStaff = requireRole("admin", "reception", "coach");
  const admin = requireRole("admin");

  api.get(
    "/api/tariffs",
    {
      preHandler: anyStaff,
      schema: {
        querystring: z.object({ includeArchived: z.stringbool().default(false) }),
        response: { 200: z.array(tariffView) },
      },
    },
    async (request) => service.list({ includeArchived: request.query.includeArchived }),
  );

  api.get(
    "/api/tariffs/:id",
    {
      preHandler: anyStaff,
      schema: { params: idParams, response: { 200: tariffView } },
    },
    async (request) => service.get(request.params.id),
  );

  api.post(
    "/api/tariffs",
    {
      preHandler: admin,
      schema: { body: newTariff, response: { 201: tariffView } },
    },
    async (request, reply) => reply.code(201).send(await service.create(request.body)),
  );

  api.patch(
    "/api/tariffs/:id",
    {
      preHandler: admin,
      schema: { params: idParams, body: tariffChanges, response: { 200: tariffView } },
    },
    async (request) => {
      const { version, ...changes } = request.body;
      return service.update(request.params.id, version, changes);
    },
  );

  api.post(
    "/api/tariffs/:id/archive",
    {
      preHandler: admin,
      schema: { params: idParams, response: { 200: tariffView } },
    },
    async (request) => service.archive(request.params.id),
  );
};
