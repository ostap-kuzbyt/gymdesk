import { cpSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node24",
  clean: true,
  noExternal: ["@gymdesk/shared"],
  onSuccess: async () => {
    cpSync("src/platform/db/migrations", "dist/migrations", { recursive: true });
  },
});
