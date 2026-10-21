import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { createDb } from "../platform/db/client.js";
import { runMigrations } from "../platform/db/migrate.js";
import { TEMPLATE_DATABASE } from "./test-db.js";

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const adminUrl = container.getConnectionUri();

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  await admin.end();

  const templateUrl = new URL(adminUrl);
  templateUrl.pathname = `/${TEMPLATE_DATABASE}`;
  const template = createDb(templateUrl.toString());
  await runMigrations(template.db);
  await template.close();

  project.provide("pgAdminUrl", adminUrl);

  return async () => {
    await container.stop();
  };
}
