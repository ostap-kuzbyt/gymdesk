import { buildApp } from "./app.js";
import { loadConfig } from "./platform/config.js";
import { createDb } from "./platform/db/client.js";
import { runMigrations } from "./platform/db/migrate.js";

const config = loadConfig();
const app = buildApp(config);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "Shutting down");
    void app.close().then(() => process.exit(0));
  });
}

try {
  if (config.MIGRATE_ON_START) {
    app.log.info("Applying database migrations");
    const { db, close } = createDb(config.DATABASE_URL);
    try {
      await runMigrations(db);
    } finally {
      await close();
    }
  }
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
