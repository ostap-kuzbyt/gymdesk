import { clearDemoData, seedDemoData } from "./demo-data.js";
import { createClock } from "./platform/clock.js";
import { createDb } from "./platform/db/client.js";
import { runMigrations } from "./platform/db/migrate.js";

function numberFlag(name: string, fallback: number): number {
  const flag = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  const value = flag ? Number(flag.split("=")[1]) : fallback;
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`--${name} must be a positive integer`);
  return value;
}

const databaseUrl = process.env.DATABASE_URL ?? "postgres://gymdesk:gymdesk@localhost:5432/gymdesk";
const timeZone = process.env.CLUB_TIMEZONE ?? "Europe/Kyiv";
const { db, close } = createDb(databaseUrl);

try {
  await runMigrations(db);
  if (process.argv.includes("--reset")) await clearDemoData(db);

  const summary = await seedDemoData(db, {
    today: createClock(timeZone).today(),
    days: numberFlag("days", 120),
    members: numberFlag("members", 40),
    seed: numberFlag("seed", 2026),
    timeZone,
  });

  process.stdout.write(`Demo data created:\n${JSON.stringify(summary, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await close();
}
