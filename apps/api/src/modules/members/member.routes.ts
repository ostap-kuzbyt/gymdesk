import {
  checkInView,
  coachAssignment,
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
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import { assertOwnedBy } from "../../platform/scope.js";
import type { ScopeResolver } from "../../platform/scope.js";
import type { MemberService } from "./member.service.js";

export interface MemberRoutesOptions {
  service: MemberService;
  requireRole: RoleGuard;
  scopeOf: ScopeResolver;
}

const idParams = z.object({ id });
const subscriptionParams = z.object({ id, subscriptionId: id });

export const memberRoutes: FastifyPluginAsync<MemberRoutesOptions> = async (
  app,
  { service, requireRole, scopeOf },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const anyStaff = requireRole("admin", "reception", "coach");
  const frontDesk = requireRole("admin", "reception");

  async function ownMember(request: FastifyRequest, memberId: string) {
    const member = await service.get(memberId);
    assertOwnedBy(await scopeOf(request), member.coachId);
    return member;
  }

  api.get(
    "/api/members",
    { preHandler: anyStaff, schema: { querystring: memberSearch, response: { 200: memberPage } } },
    async (request) => {
      const scope = await scopeOf(request);
      if (scope.kind === "club") return service.search(request.query);
      if (scope.coachId === null) return { items: [], total: 0 };
      return service.search({ ...request.query, coachId: scope.coachId });
    },
  );

  api.get(
    "/api/members/:id",
    { preHandler: anyStaff, schema: { params: idParams, response: { 200: memberView } } },
    async (request) => ownMember(request, request.params.id),
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
    async (request) => (await ownMember(request, request.params.id)).subscriptions,
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
    async (request) => {
      await ownMember(request, request.params.id);
      return service.visits(request.params.id, request.query);
    },
  );

  api.put(
    "/api/members/:id/coach",
    {
      preHandler: frontDesk,
      schema: { params: idParams, body: coachAssignment, response: { 200: memberView } },
    },
    async (request) => service.assignCoach(request.params.id, request.body.coachId),
  );

  api.get(
    "/api/coaches/:id/members",
    {
      preHandler: anyStaff,
      schema: { params: idParams, querystring: memberSearch, response: { 200: memberPage } },
    },
    async (request) => {
      assertOwnedBy(await scopeOf(request), request.params.id);
      return service.membersOfCoach(request.params.id, request.query);
    },
  );
};
