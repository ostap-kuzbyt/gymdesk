import {
  id,
  newWorkout,
  reservationRequest,
  workoutListItem,
  workoutQuery,
  workoutView,
} from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import { assertOwnedBy } from "../../platform/scope.js";
import type { ScopeResolver } from "../../platform/scope.js";
import type { WorkoutService } from "./workout.service.js";

export interface WorkoutRoutesOptions {
  service: WorkoutService;
  requireRole: RoleGuard;
  scopeOf: ScopeResolver;
}

const idParams = z.object({ id });
const reservationParams = z.object({ id, reservationId: id });

export const workoutRoutes: FastifyPluginAsync<WorkoutRoutesOptions> = async (
  app,
  { service, requireRole, scopeOf },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const anyStaff = requireRole("admin", "reception", "coach");
  const frontDesk = requireRole("admin", "reception");

  api.get(
    "/api/workouts",
    {
      preHandler: anyStaff,
      schema: { querystring: workoutQuery, response: { 200: z.array(workoutListItem) } },
    },
    async (request) => {
      const scope = await scopeOf(request);
      if (scope.kind === "club") return service.list(request.query);
      if (scope.coachId === null) return [];
      return service.list({ ...request.query, coachId: scope.coachId });
    },
  );

  api.get(
    "/api/workouts/:id",
    { preHandler: anyStaff, schema: { params: idParams, response: { 200: workoutView } } },
    async (request) => {
      const workout = await service.get(request.params.id);
      assertOwnedBy(await scopeOf(request), workout.coachId);
      return workout;
    },
  );

  api.post(
    "/api/workouts",
    { preHandler: frontDesk, schema: { body: newWorkout, response: { 201: workoutView } } },
    async (request, reply) => reply.code(201).send(await service.schedule(request.body)),
  );

  api.post(
    "/api/workouts/:id/cancel",
    { preHandler: frontDesk, schema: { params: idParams, response: { 200: workoutView } } },
    async (request) => service.cancel(request.params.id),
  );

  api.post(
    "/api/workouts/:id/reservations",
    {
      preHandler: frontDesk,
      schema: { params: idParams, body: reservationRequest, response: { 201: workoutView } },
    },
    async (request, reply) =>
      reply.code(201).send(await service.reserve(request.params.id, request.body.memberId)),
  );

  api.post(
    "/api/workouts/:id/reservations/:reservationId/cancel",
    {
      preHandler: frontDesk,
      schema: { params: reservationParams, response: { 200: workoutView } },
    },
    async (request) => service.cancelReservation(request.params.id, request.params.reservationId),
  );
};
