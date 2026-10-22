import {
  id,
  memberChanges,
  memberPage,
  memberSearch,
  memberView,
  newMember,
} from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import type { MemberService } from "./member.service.js";

export interface MemberRoutesOptions {
  service: MemberService;
  requireRole: RoleGuard;
}

const idParams = z.object({ id });

export const memberRoutes: FastifyPluginAsync<MemberRoutesOptions> = async (
  app,
  { service, requireRole },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const anyStaff = requireRole("admin", "reception", "coach");
  const frontDesk = requireRole("admin", "reception");

  api.get(
    "/api/members",
    { preHandler: anyStaff, schema: { querystring: memberSearch, response: { 200: memberPage } } },
    async (request) => service.search(request.query),
  );

  api.get(
    "/api/members/:id",
    { preHandler: anyStaff, schema: { params: idParams, response: { 200: memberView } } },
    async (request) => service.get(request.params.id),
  );

  api.post(
    "/api/members",
    { preHandler: frontDesk, schema: { body: newMember, response: { 201: memberView } } },
    async (request, reply) => reply.code(201).send(await service.register(request.body)),
  );

  api.patch(
    "/api/members/:id",
    {
      preHandler: frontDesk,
      schema: { params: idParams, body: memberChanges, response: { 200: memberView } },
    },
    async (request) => {
      const { version, ...changes } = request.body;
      return service.update(request.params.id, version, changes);
    },
  );
};
