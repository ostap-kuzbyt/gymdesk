import {
  checkInView,
  id,
  memberChanges,
  memberPage,
  memberSearch,
  memberView,
  newMember,
  subscriptionPurchase,
  subscriptionView,
  visitHistoryQuery,
  visitPage,
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
const subscriptionParams = z.object({ id, subscriptionId: id });

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

  api.get(
    "/api/members/:id/subscriptions",
    {
      preHandler: anyStaff,
      schema: { params: idParams, response: { 200: z.array(subscriptionView) } },
    },
    async (request) => (await service.get(request.params.id)).subscriptions,
  );

  api.post(
    "/api/members/:id/subscriptions",
    {
      preHandler: frontDesk,
      schema: { params: idParams, body: subscriptionPurchase, response: { 201: memberView } },
    },
    async (request, reply) =>
      reply.code(201).send(await service.purchaseSubscription(request.params.id, request.body)),
  );

  api.post(
    "/api/members/:id/subscriptions/:subscriptionId/cancel",
    {
      preHandler: frontDesk,
      schema: { params: subscriptionParams, response: { 200: memberView } },
    },
    async (request) => service.cancelSubscription(request.params.id, request.params.subscriptionId),
  );

  api.post(
    "/api/members/:id/check-ins",
    {
      preHandler: frontDesk,
      schema: { params: idParams, response: { 201: checkInView } },
    },
    async (request, reply) => reply.code(201).send(await service.checkIn(request.params.id)),
  );

  api.get(
    "/api/members/:id/check-ins",
    {
      preHandler: anyStaff,
      schema: { params: idParams, querystring: visitHistoryQuery, response: { 200: visitPage } },
    },
    async (request) => service.visits(request.params.id, request.query),
  );
};
