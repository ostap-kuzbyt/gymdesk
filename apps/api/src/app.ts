import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { memberRoutes } from "./modules/members/member.routes.js";
import { MemberService } from "./modules/members/member.service.js";
import { studioRoutes } from "./modules/studios/studio.routes.js";
import { StudioService } from "./modules/studios/studio.service.js";
import { tariffRoutes } from "./modules/tariffs/tariff.routes.js";
import { TariffService } from "./modules/tariffs/tariff.service.js";
import { createAuth0Verifier, registerAuth } from "./platform/auth.js";
import type { TokenVerifier } from "./platform/auth.js";
import { createClock } from "./platform/clock.js";
import type { Clock } from "./platform/clock.js";
import type { Config } from "./platform/config.js";
import { createDb } from "./platform/db/client.js";
import type { Db } from "./platform/db/client.js";
import { registerErrorHandler } from "./platform/errors.js";
import { healthRoutes } from "./platform/health.routes.js";

export interface AppOverrides {
  db?: Db;
  clock?: Clock;
  verifier?: TokenVerifier;
}

export function buildApp(config: Config, overrides: AppOverrides = {}): FastifyInstance {
  const app = Fastify({
    logger: config.NODE_ENV === "test" ? false : { level: config.LOG_LEVEL },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  let db = overrides.db;
  if (!db) {
    const handle = createDb(config.DATABASE_URL);
    db = handle.db;
    app.addHook("onClose", () => handle.close());
  }
  const clock = overrides.clock ?? createClock(config.CLUB_TIMEZONE);
  const requireRole = registerAuth(app, overrides.verifier ?? createAuth0Verifier(config));

  const tariffService = new TariffService(db);

  app.register(healthRoutes);
  app.register(memberRoutes, {
    service: new MemberService(db, clock, tariffService),
    requireRole,
  });
  app.register(studioRoutes, { service: new StudioService(db), requireRole });
  app.register(tariffRoutes, { service: tariffService, requireRole });

  return app;
}
