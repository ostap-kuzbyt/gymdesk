import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./client.js";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

export function runMigrations(db: Db): Promise<void> {
  return migrate(db, { migrationsFolder });
}
