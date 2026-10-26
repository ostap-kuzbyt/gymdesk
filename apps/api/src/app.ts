import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { coachRoutes } from "./modules/coaches/coach.routes.js";
import { CoachService } from "./modules/coaches/coach.service.js";
import { registerExpiryScan } from "./modules/reminders/reminder.job.js";
import { reportRoutes } from "./modules/reports/report.routes.js";
import { ReportService } from "./modules/reports/report.service.js";
import { reminderRoutes } from "./modules/reminders/reminder.routes.js";
import { ReminderService } from "./modules/reminders/reminder.service.js";
import { memberRoutes } from "./modules/members/member.routes.js";
import { MemberService } from "./modules/members/member.service.js";
import { studioRoutes } from "./modules/studios/studio.routes.js";
import { StudioService } from "./modules/studios/studio.service.js";
import { workoutRoutes } from "./modules/workouts/workout.routes.js";
import { WorkoutService } from "./modules/workouts/workout.service.js";
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
import { createMailer } from "./platform/mailer.js";
import type { Mailer } from "./platform/mailer.js";
import { createPgBossQueue } from "./platform/queue.js";
import type { Queue } from "./platform/queue.js";
import { healthRoutes } from "./platform/health.routes.js";

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
  const coachService = new CoachService(db);
  const studioService = new StudioService(db);
  const memberService = new MemberService(db, clock, tariffService, coachService);
  const mailer = overrides.mailer ?? createMailer(config, app.log);
  const reminderService = new ReminderService(db, clock, mailer, memberService, {
    clubName: config.CLUB_NAME,
    daysBefore: config.REMINDER_DAYS_BEFORE,
    discountPercent: config.PROMO_DISCOUNT_PERCENT,
  });
  const queue =
    overrides.queue ??
    (config.RUN_JOBS && config.NODE_ENV !== "test"
      ? createPgBossQueue(config.DATABASE_URL, app.log)
      : undefined);
  if (queue) {
    app.addHook("onReady", async () => {
      await queue.start();
      await registerExpiryScan(queue, reminderService, {
        cron: config.EXPIRY_SCAN_CRON,
        timeZone: config.CLUB_TIMEZONE,
        onFinished: (result) => app.log.info(result, "Expiry reminder scan finished"),
      });
    });
    app.addHook("onClose", () => queue.stop());
  }

  const workoutService = new WorkoutService(db, clock, studioService, coachService, memberService);

  app.register(healthRoutes);
  app.register(tariffRoutes, { service: tariffService, requireRole });
  app.register(studioRoutes, { service: studioService, requireRole });
  app.register(coachRoutes, { service: coachService, requireRole });
  app.register(memberRoutes, { service: memberService, requireRole });
  app.register(workoutRoutes, { service: workoutService, requireRole });
  app.register(reminderRoutes, { service: reminderService, requireRole });
  app.register(reportRoutes, { service: new ReportService(db, clock), requireRole });

  return app;
}
