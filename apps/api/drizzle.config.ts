import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/platform/db/schema.ts",
  out: "./src/platform/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://gymdesk:gymdesk@localhost:5432/gymdesk",
  },
});
