import { loadConfig } from "../platform/config.js";
import type { Config } from "../platform/config.js";

export const testAuth = {
  issuer: "https://gymdesk-test.eu.auth0.com/",
  audience: "https://api.gymdesk.test",
  rolesClaim: "https://gymdesk/roles",
};

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgres://localhost/gymdesk_test",
    AUTH0_DOMAIN: "gymdesk-test.eu.auth0.com",
    AUTH0_AUDIENCE: testAuth.audience,
    AUTH0_ROLES_CLAIM: testAuth.rolesClaim,
    ...overrides,
  });
}
