import { z } from "zod";

export type AppEnvironment = "development" | "test" | "staging" | "production";
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export type AppConfig = {
  readonly environment: AppEnvironment;
  readonly appName: string;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly apiBasePath: string;
  readonly corsOrigins: readonly string[];
  readonly publicAppUrl?: string;
  readonly requestBodyLimitBytes: number;
  readonly databaseUrl?: string;
  readonly databaseMigrationUrl?: string;
  readonly databasePoolMax: number;
  readonly supabaseUrl?: string;
  readonly supabaseAnonKey?: string;
  readonly supabaseAdminKey?: string;
  readonly supabaseJwtIssuer?: string;
  readonly supabaseJwtAudience?: string;
  readonly supabaseJwksUrl?: string;
  readonly supabaseJwksTimeoutMs: number;
};

export type ConfigIssue = {
  readonly path: string;
  readonly message: string;
};

export class ConfigValidationError extends Error {
  constructor(readonly issues: readonly ConfigIssue[]) {
    super("Backend configuration is invalid.");
    this.name = "ConfigValidationError";
  }
}

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().trim().url().optional());

const rawEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    BACKEND_APP_NAME: z.string().trim().min(1).default("SaaS App Backend"),
    BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    BACKEND_LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    BACKEND_API_BASE_PATH: z
      .string()
      .trim()
      .regex(/^\/[a-z0-9][a-z0-9/-]*$/, "must start with / and use lowercase URL-safe segments")
      .default("/api/v1"),
    BACKEND_CORS_ORIGINS: optionalString,
    BACKEND_PUBLIC_APP_URL: optionalUrl,
    BACKEND_REQUEST_BODY_LIMIT_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(10 * 1024 * 1024)
      .default(1024 * 1024),
    BACKEND_DATABASE_URL: optionalString,
    BACKEND_DATABASE_MIGRATION_URL: optionalString,
    BACKEND_DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    BACKEND_SUPABASE_URL: optionalUrl,
    BACKEND_SUPABASE_ANON_KEY: optionalString,
    BACKEND_SUPABASE_ADMIN_KEY: optionalString,
    BACKEND_SUPABASE_JWT_ISSUER: optionalUrl,
    BACKEND_SUPABASE_JWT_AUDIENCE: optionalString,
    BACKEND_SUPABASE_JWKS_URL: optionalUrl,
    BACKEND_SUPABASE_JWKS_TIMEOUT_MS: z.coerce.number().int().min(100).max(5000).default(1500),
  })
  .superRefine((value, context) => {
    const productionLike = value.NODE_ENV === "production" || value.NODE_ENV === "staging";
    if (productionLike && !value.BACKEND_CORS_ORIGINS) {
      context.addIssue({
        code: "custom",
        path: ["BACKEND_CORS_ORIGINS"],
        message: "is required for staging and production",
      });
    }
    if (value.NODE_ENV === "production" && !value.BACKEND_PUBLIC_APP_URL) {
      context.addIssue({
        code: "custom",
        path: ["BACKEND_PUBLIC_APP_URL"],
        message: "is required for production",
      });
    }
    if (productionLike && !value.BACKEND_DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["BACKEND_DATABASE_URL"],
        message: "is required for staging and production",
      });
    }
    if (value.BACKEND_CORS_ORIGINS?.split(",").some((origin) => origin.trim() === "*")) {
      context.addIssue({
        code: "custom",
        path: ["BACKEND_CORS_ORIGINS"],
        message: "must not include wildcard origins",
      });
    }
  });

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = rawEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "environment",
        message: issue.message,
      })),
    );
  }

  const corsOrigins = parseCorsOrigins(parsed.data.BACKEND_CORS_ORIGINS, parsed.data.NODE_ENV);

  return {
    environment: parsed.data.NODE_ENV,
    appName: parsed.data.BACKEND_APP_NAME,
    port: parsed.data.BACKEND_PORT,
    logLevel: parsed.data.BACKEND_LOG_LEVEL,
    apiBasePath: parsed.data.BACKEND_API_BASE_PATH.replace(/\/+$/, ""),
    corsOrigins,
    publicAppUrl: parsed.data.BACKEND_PUBLIC_APP_URL,
    requestBodyLimitBytes: parsed.data.BACKEND_REQUEST_BODY_LIMIT_BYTES,
    databaseUrl: parsed.data.BACKEND_DATABASE_URL,
    databaseMigrationUrl: parsed.data.BACKEND_DATABASE_MIGRATION_URL,
    databasePoolMax: parsed.data.BACKEND_DATABASE_POOL_MAX,
    supabaseUrl: parsed.data.BACKEND_SUPABASE_URL,
    supabaseAnonKey: parsed.data.BACKEND_SUPABASE_ANON_KEY,
    supabaseAdminKey: parsed.data.BACKEND_SUPABASE_ADMIN_KEY,
    supabaseJwtIssuer:
      parsed.data.BACKEND_SUPABASE_JWT_ISSUER ?? issuerFromSupabaseUrl(parsed.data.BACKEND_SUPABASE_URL),
    supabaseJwtAudience: parsed.data.BACKEND_SUPABASE_JWT_AUDIENCE ?? "authenticated",
    supabaseJwksUrl:
      parsed.data.BACKEND_SUPABASE_JWKS_URL ?? jwksUrlFromSupabaseUrl(parsed.data.BACKEND_SUPABASE_URL),
    supabaseJwksTimeoutMs: parsed.data.BACKEND_SUPABASE_JWKS_TIMEOUT_MS,
  };
}

function parseCorsOrigins(raw: string | undefined, environment: AppEnvironment): readonly string[] {
  const origins =
    raw
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ??
    (environment === "development" || environment === "test"
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : []);

  const invalid = origins.find((origin) => {
    try {
      new URL(origin);
      return false;
    } catch {
      return true;
    }
  });

  if (invalid) {
    throw new ConfigValidationError([
      { path: "BACKEND_CORS_ORIGINS", message: `contains invalid URL: ${invalid}` },
    ]);
  }

  return origins;
}

function issuerFromSupabaseUrl(supabaseUrl: string | undefined): string | undefined {
  return supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/auth/v1` : undefined;
}

function jwksUrlFromSupabaseUrl(supabaseUrl: string | undefined): string | undefined {
  return supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json` : undefined;
}

export function formatConfigError(error: unknown): string {
  if (error instanceof ConfigValidationError) {
    return error.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "Unknown startup error";
}
