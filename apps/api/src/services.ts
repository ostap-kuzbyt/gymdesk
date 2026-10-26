import { CoachService } from "./modules/coaches/coach.service.js";
import { MemberService } from "./modules/members/member.service.js";
import { ReminderService } from "./modules/reminders/reminder.service.js";
import type { ReminderSettings } from "./modules/reminders/reminder.service.js";
import { ReportService } from "./modules/reports/report.service.js";
import { StudioService } from "./modules/studios/studio.service.js";
import { TariffService } from "./modules/tariffs/tariff.service.js";
import { WorkoutService } from "./modules/workouts/workout.service.js";
import type { Clock } from "./platform/clock.js";
import type { Db } from "./platform/db/client.js";
import type { Mailer } from "./platform/mailer.js";

export interface ServiceDeps {
  db: Db;
  clock: Clock;
  mailer: Mailer;
  reminders: ReminderSettings;
}

export function createServices({ db, clock, mailer, reminders }: ServiceDeps) {
  const tariffs = new TariffService(db);
  const coaches = new CoachService(db);
  const studios = new StudioService(db);
  const members = new MemberService(db, clock, tariffs, coaches);

  return {
    tariffs,
    coaches,
    studios,
    members,
    workouts: new WorkoutService(db, clock, studios, coaches, members),
    reminders: new ReminderService(db, clock, mailer, members, reminders),
    reports: new ReportService(db, clock),
  };
}

export type Services = ReturnType<typeof createServices>;
