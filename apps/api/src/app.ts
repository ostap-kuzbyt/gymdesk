import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { coachRoutes } from "./modules/coaches/coach.routes.js";
import { registerExpiryScan } from "./modules/reminders/reminder.job.js";
import { reportRoutes } from "./modules/reports/report.routes.js";
import { reminderRoutes } from "./modules/reminders/reminder.routes.js";
import { memberRoutes } from "./modules/members/member.routes.js";
import { studioRoutes } from "./modules/studios/studio.routes.js";
import { workoutRoutes } from "./modules/workouts/workout.routes.js";
import { tariffRoutes } from "./modules/tariffs/tariff.routes.js";
import { createAuth0Verifier, registerAuth } from "./platform/auth.js";
import type { TokenVerifier } from "./platform/auth.js";
import { createClock } from "./platform/clock.js";
import type { Clock } from "./platform/clock.js";
import type { Config } from "./platform/config.js";
import { createDb } from "./platform/db/client.js";
import type { Db } from "./platform/db/client.js";
import { registerDocs } from "./platform/docs.js";
import { registerErrorHandler } from "./platform/errors.js";
import { createMailer } from "./platform/mailer.js";
import { meRoutes } from "./platform/me.routes.js";
import { createScopeResolver } from "./platform/scope.js";
import type { Mailer } from "./platform/mailer.js";
import { createPgBossQueue } from "./platform/queue.js";
import type { Queue } from "./platform/queue.js";
import { healthRoutes } from "./platform/health.routes.js";
import { createServices } from "./services.js";

export interface AppOverrides {
  db?: Db;
  clock?: Clock;
  mailer?: Mailer;
  queue?: Queue;
  verifier?: TokenVerifier;
}

export function buildApp(config: Config, overrides: AppOverrides = {}): FastifyInstance {
  const app = Fastify({
    logger: config.NODE_ENV === "test" ? false : { level: config.LOG_LEVEL },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  if (config.CORS_ORIGIN.length > 0) {
    app.register(cors, {
      origin: config.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["authorization", "content-type"],
      maxAge: 86_400,
    });
  }

  registerErrorHandler(app);
  registerDocs(app, config);

  let db = overrides.db;
  if (!db) {
    const handle = createDb(config.DATABASE_URL);
    db = handle.db;
    app.addHook("onClose", () => handle.close());
  }
  const clock = overrides.clock ?? createClock(config.CLUB_TIMEZONE);
  const requireRole = registerAuth(app, overrides.verifier ?? createAuth0Verifier(config));

  const mailer = overrides.mailer ?? createMailer(config, app.log);
  const services = createServices({
    db,
    clock,
    mailer,
    reminders: {
      clubName: config.CLUB_NAME,
      daysBefore: config.REMINDER_DAYS_BEFORE,
      discountPercent: config.PROMO_DISCOUNT_PERCENT,
    },
  });

  const queue =
    overrides.queue ??
    (config.RUN_JOBS && config.NODE_ENV !== "test"
      ? createPgBossQueue(config.DATABASE_URL, app.log)
      : undefined);
  if (queue) {
    app.addHook("onReady", async () => {
      await queue.start();
      await registerExpiryScan(queue, services.reminders, {
        cron: config.EXPIRY_SCAN_CRON,
        timeZone: config.CLUB_TIMEZONE,
        onFinished: (result) => app.log.info(result, "Expiry reminder scan finished"),
      });
    });
    app.addHook("onClose", () => queue.stop());
  }

  const coachIdOf = (subject: string) => services.coaches.idOfSubject(subject);
  const scopeOf = createScopeResolver(coachIdOf);

  app.register(healthRoutes);
  app.register(meRoutes, { requireRole, coachIdOf });
  app.register(tariffRoutes, { service: services.tariffs, requireRole });
  app.register(studioRoutes, { service: services.studios, requireRole });
  app.register(coachRoutes, { service: services.coaches, requireRole });
  app.register(memberRoutes, { service: services.members, requireRole, scopeOf });
  app.register(workoutRoutes, { service: services.workouts, requireRole, scopeOf });
  app.register(reminderRoutes, { service: services.reminders, requireRole });
  app.register(reportRoutes, { service: services.reports, requireRole });

  return app;
}
