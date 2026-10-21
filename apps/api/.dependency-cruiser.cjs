const SOURCE = "^src/";
const MODULE_FILE = "^src/modules/([^/]+)/";
const ENTITY_FILE = "^src/modules/[^/]+/[^./]+\\.ts$";

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "entity-has-no-framework-imports",
      severity: "error",
      from: { path: ENTITY_FILE },
      to: { path: "node_modules/(fastify|drizzle-orm|pg)(/|$)" },
    },
    {
      name: "entity-only-uses-error-types-from-platform",
      severity: "error",
      from: { path: ENTITY_FILE },
      to: { path: "^src/platform/", pathNot: "^src/platform/errors\\.ts$" },
    },
    {
      name: "entity-does-not-depend-on-its-own-layers",
      severity: "error",
      from: { path: ENTITY_FILE },
      to: { path: "\\.(repo|service|routes)\\.ts$" },
    },
    {
      name: "repo-does-not-use-service-or-routes",
      severity: "error",
      from: { path: "\\.repo\\.ts$" },
      to: { path: "\\.(service|routes)\\.ts$" },
    },
    {
      name: "service-does-not-use-routes",
      severity: "error",
      from: { path: "\\.service\\.ts$" },
      to: { path: "\\.routes\\.ts$" },
    },
    {
      name: "modules-talk-through-services",
      severity: "error",
      from: { path: MODULE_FILE },
      to: {
        path: "^src/modules/[^/]+/",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/[^/]+\\.service\\.ts$"],
      },
    },
    {
      name: "platform-does-not-know-modules",
      severity: "error",
      from: { path: "^src/platform/" },
      to: { path: "^src/modules/" },
    },
    {
      name: "testing-helpers-only-in-tests",
      severity: "error",
      from: { path: SOURCE, pathNot: ["\\.test\\.ts$", "^src/testing/"] },
      to: { path: "^src/testing/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    exclude: { path: "\\.d\\.ts$" },
  },
};
