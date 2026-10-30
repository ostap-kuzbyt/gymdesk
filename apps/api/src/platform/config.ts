import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim()));

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
  } catch {
    return false;
  }
}

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().min(1),
    AUTH0_DOMAIN: z.string().min(1),
    AUTH0_AUDIENCE: z.string().min(1),
    AUTH0_ROLES_CLAIM: z.string().min(1),
    CLUB_TIMEZONE: z
      .string()
      .default("Europe/Kyiv")
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat("en-CA", { timeZone: zone });
          return true;
        } catch {
          return false;
        }
      }, "Must be a valid IANA time zone"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CLUB_NAME: z.string().trim().min(1).default("Gymdesk"),
    REMINDER_DAYS_BEFORE: z.coerce.number().int().min(1).max(60).default(7),
    PROMO_DISCOUNT_PERCENT: z.coerce.number().int().min(1).max(90).default(10),
    RUN_JOBS: z.stringbool().default(true),
    MIGRATE_ON_START: z.stringbool().default(false),
    EXPIRY_SCAN_CRON: z
      .string()
      .trim()
      .regex(/^(\S+\s+){4}\S+$/, "Must be a five-field cron expression")
      .default("0 8 * * *"),
    SENDGRID_API_KEY: optionalText,
    MAIL_FROM: optionalText,
    CORS_ORIGIN: optionalText
      .transform((value) =>
        value === undefined ? [] : value.split(",").map((item) => item.trim()),
      )
      .refine(
        (origins) => origins.every(isOrigin),
        "Must be a comma-separated list of origins like https://gymdesk.vercel.app",
      ),
  })
  .superRefine((config, context) => {
    if (config.SENDGRID_API_KEY && !config.MAIL_FROM) {
      context.addIssue({
        code: "custom",
        path: ["MAIL_FROM"],
        message: "MAIL_FROM is required when SENDGRID_API_KEY is set",
      });
    }
    if (config.MAIL_FROM && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.MAIL_FROM)) {
      context.addIssue({
        code: "custom",
        path: ["MAIL_FROM"],
        message: "MAIL_FROM must be an email address",
      });
    }
  });

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  return parsed.data;
}
