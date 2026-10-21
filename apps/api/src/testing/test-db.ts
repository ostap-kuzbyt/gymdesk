import { randomBytes } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";
import { createDb } from "../platform/db/client.js";
import type { Db } from "../platform/db/client.js";

declare module "vitest" {
  export interface ProvidedContext {
    pgAdminUrl: string;
  }
}

export const TEMPLATE_DATABASE = "gymdesk_template";

export interface TestDb {
  db: Db;
  url: string;
  dispose: () => Promise<void>;
}

async function runAdmin(statement: string): Promise<void> {
  const admin = new pg.Client({ connectionString: inject("pgAdminUrl") });
  await admin.connect();
  try {
    await admin.query(statement);
  } finally {
    await admin.end();
  }
}

export async function createTestDb(): Promise<TestDb> {
  const name = `t_${randomBytes(6).toString("hex")}`;
  await runAdmin(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`);

  const url = new URL(inject("pgAdminUrl"));
  url.pathname = `/${name}`;
  const handle = createDb(url.toString());

  return {
    db: handle.db,
    url: url.toString(),
    dispose: async () => {
      await handle.close();
      await runAdmin(`DROP DATABASE ${name} WITH (FORCE)`);
    },
  };
}
