import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.string().default(""),
  VITE_AUTH0_DOMAIN: z.string().trim().min(1),
  VITE_AUTH0_CLIENT_ID: z.string().trim().min(1),
  VITE_AUTH0_AUDIENCE: z.string().trim().min(1),
  VITE_AUTH0_ROLES_CLAIM: z.string().trim().min(1).default("https://gymdesk/roles"),
});

export interface WebConfig {
  apiUrl: string;
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
    rolesClaim: string;
  };
}

export type ConfigResult = { ok: true; config: WebConfig } | { ok: false; missing: string[] };

export function readWebConfig(env: Record<string, unknown>): ConfigResult {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    return { ok: false, missing };
  }

  const values = parsed.data;
  return {
    ok: true,
    config: {
      apiUrl: values.VITE_API_URL.replace(/\/+$/, ""),
      auth0: {
        domain: values.VITE_AUTH0_DOMAIN,
        clientId: values.VITE_AUTH0_CLIENT_ID,
        audience: values.VITE_AUTH0_AUDIENCE,
        rolesClaim: values.VITE_AUTH0_ROLES_CLAIM,
      },
    },
  };
}
