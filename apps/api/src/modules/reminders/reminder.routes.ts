import {
  id,
  manualReminder,
  reminderPage,
  reminderQuery,
  reminderView,
  scanResult,
} from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { RoleGuard } from "../../platform/auth.js";
import type { ReminderService } from "./reminder.service.js";

export interface ReminderRoutesOptions {
  service: ReminderService;
  requireRole: RoleGuard;
}

const idParams = z.object({ id });

export const reminderRoutes: FastifyPluginAsync<ReminderRoutesOptions> = async (
  app,
  { service, requireRole },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const frontDesk = requireRole("admin", "reception");
  const admin = requireRole("admin");

  api.get(
    "/api/reminders",
    {
      preHandler: frontDesk,
      schema: { querystring: reminderQuery, response: { 200: reminderPage } },
    },
    async (request) => service.list(request.query),
  );

  api.post(
    "/api/reminders/scan",
    { preHandler: admin, schema: { response: { 200: scanResult } } },
    async () => service.scanExpiring(),
  );

  api.post(
    "/api/reminders/:id/retry",
    { preHandler: frontDesk, schema: { params: idParams, response: { 200: reminderView } } },
    async (request) => service.retry(request.params.id),
  );

  api.post(
    "/api/members/:id/reminders",
    {
      preHandler: frontDesk,
      schema: { params: idParams, body: manualReminder, response: { 201: reminderView } },
    },
    async (request, reply) =>
      reply.code(201).send(await service.sendManual(request.params.id, request.body.kind)),
  );
};
