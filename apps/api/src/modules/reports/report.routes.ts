import {
  attendanceQuery,
  attendanceReport,
  loadQuery,
  loadReport,
  revenueQuery,
  revenueReport,
} from "@gymdesk/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { RoleGuard } from "../../platform/auth.js";
import type { ReportService } from "./report.service.js";

export interface ReportRoutesOptions {
  service: ReportService;
  requireRole: RoleGuard;
}

export const reportRoutes: FastifyPluginAsync<ReportRoutesOptions> = async (
  app,
  { service, requireRole },
) => {
  const api = app.withTypeProvider<ZodTypeProvider>();
  const frontDesk = requireRole("admin", "reception");
  const admin = requireRole("admin");

  api.get(
    "/api/reports/attendance",
    {
      preHandler: frontDesk,
      schema: { querystring: attendanceQuery, response: { 200: attendanceReport } },
    },
    async (request) => {
      const { limit, offset, ...range } = request.query;
      return service.attendance(range, { limit, offset });
    },
  );

  api.get(
    "/api/reports/revenue",
    { preHandler: admin, schema: { querystring: revenueQuery, response: { 200: revenueReport } } },
    async (request) => {
      const { granularity, ...range } = request.query;
      return service.revenue(range, granularity);
    },
  );

  api.get(
    "/api/reports/load",
    { preHandler: frontDesk, schema: { querystring: loadQuery, response: { 200: loadReport } } },
    async (request) => service.load(request.query),
  );
};
