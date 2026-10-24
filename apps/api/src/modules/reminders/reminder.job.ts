import type { Queue } from "../../platform/queue.js";
import type { ReminderService, ScanResult } from "./reminder.service.js";

export const EXPIRY_SCAN_JOB = "reminders.expiry-scan";

export interface ExpiryScanSchedule {
  cron: string;
  timeZone: string;
  onFinished: (result: ScanResult) => void;
}

export async function registerExpiryScan(
  queue: Queue,
  service: ReminderService,
  schedule: ExpiryScanSchedule,
): Promise<void> {
  await queue.work(EXPIRY_SCAN_JOB, async () => {
    schedule.onFinished(await service.scanExpiring());
  });
  await queue.schedule(EXPIRY_SCAN_JOB, schedule.cron, schedule.timeZone);
}
