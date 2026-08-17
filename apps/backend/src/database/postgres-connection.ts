import type { PoolConfig } from "pg";

const DIRECT_HOST_PATTERN = /^db\.([a-z0-9]+)\.supabase\.co$/i;
const POOLER_HOST_PATTERN = /^(aws-\d+-[a-z0-9-]+)\.pooler\.supabase\.com$/i;

export function isSupabaseRemoteDatabaseHost(host: string): boolean {
  return DIRECT_HOST_PATTERN.test(host) || POOLER_HOST_PATTERN.test(host) || host.endsWith(".pooler.supabase.com");
}

export function normalizeSupabaseDatabaseUrl(
  rawUrl: string | undefined,
  poolerHostOverride?: string,
): string | undefined {
  if (!rawUrl) {
    return undefined;
  }
  const parsed = new URL(rawUrl);
  const host = parsed.hostname;
  const directMatch = host.match(DIRECT_HOST_PATTERN);

  if (!directMatch) {
    if (poolerHostOverride && host.match(POOLER_HOST_PATTERN)) {
      parsed.hostname = poolerHostOverride;
      return parsed.toString();
    }
    return rawUrl;
  }

  const projectRef = directMatch[1];
  const poolerHost = poolerHostOverride ?? parsed.searchParams.get("poolerHost") ?? undefined;
  if (!poolerHost) {
    return rawUrl;
  }

  parsed.hostname = poolerHost;
  parsed.searchParams.delete("poolerHost");

  const user = decodeURIComponent(parsed.username);
  if (user === "postgres") {
    parsed.username = `postgres.${projectRef}`;
  }

  return parsed.toString();
}

export function createPostgresPoolConfig(connectionString: string, overrides: PoolConfig = {}): PoolConfig {
  let ssl: PoolConfig["ssl"];
  try {
    const host = new URL(connectionString).hostname;
    if (isSupabaseRemoteDatabaseHost(host)) {
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    // Non-URL connection strings (for example testcontainers) skip SSL defaults.
  }

  return {
    connectionString,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ...(ssl ? { ssl } : {}),
    ...overrides,
  };
}
