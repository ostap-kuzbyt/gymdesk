import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import type { Config } from "./config.js";

export const API_VERSION = "0.1.0";

const SUMMARIES: Record<string, string> = {
  "GET /health": "Check that the service is running",
  "GET /api/me": "Show the signed-in account, its roles and its coach profile",

  "GET /api/tariffs": "List tariffs",
  "GET /api/tariffs/:id": "Get a tariff",
  "POST /api/tariffs": "Create a tariff",
  "PATCH /api/tariffs/:id": "Change a tariff",
  "POST /api/tariffs/:id/archive": "Archive a tariff",

  "GET /api/studios": "List studios",
  "GET /api/studios/:id": "Get a studio",
  "POST /api/studios": "Create a studio",
  "PATCH /api/studios/:id": "Change a studio",
  "POST /api/studios/:id/archive": "Archive a studio",

  "GET /api/coaches": "List coaches",
  "GET /api/coaches/:id": "Get a coach",
  "POST /api/coaches": "Create a coach",
  "PATCH /api/coaches/:id": "Change a coach or their weekly hours",
  "POST /api/coaches/:id/archive": "Archive a coach",
  "GET /api/coaches/:id/members": "List the members assigned to a coach",

  "GET /api/members": "Search members",
  "GET /api/members/:id": "Get a member with their subscriptions",
  "POST /api/members": "Register a member",
  "PATCH /api/members/:id": "Change a member's profile",
  "PUT /api/members/:id/coach": "Assign a coach to a member or clear the assignment",
  "GET /api/members/:id/subscriptions": "List a member's subscriptions",
  "POST /api/members/:id/subscriptions": "Sell a subscription to a member",
  "POST /api/members/:id/subscriptions/:subscriptionId/cancel": "Cancel a subscription",
  "GET /api/members/:id/check-ins": "List a member's visits",
  "POST /api/members/:id/check-ins": "Record a member's arrival today",
  "POST /api/members/:id/reminders": "Send an expiry reminder or a promotion to a member",

  "GET /api/workouts": "List workouts in a date range",
  "GET /api/workouts/:id": "Get a workout with its reservations",
  "POST /api/workouts": "Schedule a workout",
  "POST /api/workouts/:id/cancel": "Cancel a workout",
  "POST /api/workouts/:id/reservations": "Sign a member up for a workout",
  "POST /api/workouts/:id/reservations/:reservationId/cancel": "Cancel a reservation",

  "GET /api/reminders": "List sent and failed reminders",
  "POST /api/reminders/scan": "Run the expiry reminder scan now",
  "POST /api/reminders/:id/retry": "Retry a failed reminder",

  "GET /api/reports/attendance": "Members with their visit activity",
  "GET /api/reports/revenue": "Revenue per month or year",
  "GET /api/reports/load": "Coach and studio load per day",
};

const TAGS: Record<string, string> = {
  health: "System",
  me: "System",
  tariffs: "Tariffs",
  studios: "Studios",
  coaches: "Coaches",
  members: "Members",
  workouts: "Workouts",
  reminders: "Reminders",
  reports: "Reports",
};

function tagFor(url: string): string {
  const [, first, second] = url.split("/");
  const key = first === "api" ? second : first;
  return TAGS[key ?? ""] ?? "Other";
}

export function summaryFor(method: string, url: string): string | undefined {
  return SUMMARIES[`${method} ${url}`];
}

export function registerDocs(app: FastifyInstance, config: Config): void {
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: `${config.CLUB_NAME} API`,
        version: API_VERSION,
        description:
          "Back office API of a fitness club: members, subscriptions, check-ins, coaches, studios, workouts, reminders and reports. Send an Auth0 access token as a bearer token.",
      },
      tags: Object.values(TAGS).map((name) => ({ name })),
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: (input) => {
      const methods = Array.isArray(input.route.method) ? input.route.method : [input.route.method];
      const summary = summaryFor(String(methods[0]), input.url);
      const isPublic = input.url === "/health";
      return jsonSchemaTransform({
        ...input,
        schema: {
          ...input.schema,
          tags: [tagFor(input.url)],
          ...(summary ? { summary } : {}),
          ...(isPublic ? { security: [] } : {}),
        },
      });
    },
  });

  app.register(scalar, {
    routePrefix: "/docs",
    configuration: { metaData: { title: `${config.CLUB_NAME} API reference` } },
  });
}
