import { PgBoss } from "pg-boss";

export interface QueueLogger {
  error: (error: unknown, message: string) => void;
}

export interface Queue {
  start: () => Promise<void>;
  schedule: (name: string, cron: string, timeZone: string) => Promise<void>;
  work: (name: string, handler: () => Promise<void>) => Promise<void>;
  enqueue: (name: string) => Promise<void>;
  stop: () => Promise<void>;
}

const RETRY_LIMIT = 3;
const RETRY_DELAY_SECONDS = 60;
const STOP_TIMEOUT_MS = 10_000;

export function createPgBossQueue(connectionString: string, logger: QueueLogger): Queue {
  const boss = new PgBoss(connectionString);
  boss.on("error", (error) => logger.error(error, "The job queue reported an error"));

  const ensureQueue = (name: string) =>
    boss.createQueue(name, {
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS,
      retryBackoff: true,
    });

  return {
    start: async () => {
      await boss.start();
    },
    schedule: async (name, cron, timeZone) => {
      await ensureQueue(name);
      await boss.schedule(name, cron, null, { tz: timeZone });
    },
    work: async (name, handler) => {
      await ensureQueue(name);
      await boss.work(name, async () => {
        await handler();
      });
    },
    enqueue: async (name) => {
      await ensureQueue(name);
      await boss.send(name);
    },
    stop: () => boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS }),
  };
}
