import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const healthResponse = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number(),
});

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/health", { schema: { response: { 200: healthResponse } } }, async () => ({
      status: "ok" as const,
      uptimeSeconds: Math.round(process.uptime()),
    }));
}
