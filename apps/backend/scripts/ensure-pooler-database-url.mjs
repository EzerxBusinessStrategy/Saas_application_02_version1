import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const backendEnv = path.join(repoRoot, "apps/backend/.env");
const rootEnvLocal = path.join(repoRoot, ".env.local");

const DIRECT_HOST_PATTERN = /^db\.([a-z0-9]+)\.supabase\.co$/i;
const POOLER_HOST_PATTERN = /^aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com$/i;
const KEYS = ["BACKEND_DATABASE_URL", "BACKEND_DATABASE_MIGRATION_URL", "BACKEND_DATABASE_POOLER_HOST"];

function parsePostgresUrl(raw) {
  const match = raw.match(/^(postgres(?:ql)?:\/\/)([^@]+)@([^/]+)(\/.*)$/i);
  if (!match) return null;
  const [, scheme, userInfo, hostPort, rest] = match;
  const host = hostPort.split(":")[0];
  const portSuffix = hostPort.includes(":") ? hostPort.slice(host.length) : ":5432";
  const colon = userInfo.indexOf(":");
  const user = colon === -1 ? userInfo : userInfo.slice(0, colon);
  const password = colon === -1 ? "" : userInfo.slice(colon + 1);
  return { scheme, user, password, host, portSuffix, rest };
}

function buildPostgresUrl({ scheme, user, password, host, portSuffix, rest }) {
  const auth = password ? `${user}:${password}` : user;
  return `${scheme}${auth}@${host}${portSuffix}${rest}`;
}

function poolerCandidates(region) {
  return [`aws-0-${region}.pooler.supabase.com`, `aws-1-${region}.pooler.supabase.com`];
}

async function resolvePoolerHost(parsedUrl, explicitPoolerHost) {
  if (explicitPoolerHost) {
    return explicitPoolerHost;
  }

  const existingPooler = parsedUrl.host.match(POOLER_HOST_PATTERN);
  const direct = parsedUrl.host.match(DIRECT_HOST_PATTERN);
  const region =
    existingPooler?.[1] ??
    process.env.BACKEND_DATABASE_POOLER_REGION ??
    "ap-northeast-2";

  if (!direct && !existingPooler) {
    return parsedUrl.host;
  }

  for (const host of poolerCandidates(region)) {
    const candidate = buildPostgresUrl({ ...parsedUrl, host });
    const pool = new Pool({
      connectionString: candidate,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    try {
      await pool.query("select 1");
      await pool.end();
      return host;
    } catch {
      await pool.end().catch(() => undefined);
    }
  }

  return poolerCandidates(region)[0];
}

function convertPostgresUrl(raw, poolerHost) {
  const parsed = parsePostgresUrl(raw);
  if (!parsed) return { next: raw, changed: false, poolerHost: undefined };

  const direct = parsed.host.match(DIRECT_HOST_PATTERN);
  const pooler = parsed.host.match(POOLER_HOST_PATTERN);
  if (!direct && !pooler) return { next: raw, changed: false, poolerHost: undefined };

  const projectRef = direct?.[1];
  const nextUser =
    projectRef && parsed.user === "postgres" ? `postgres.${projectRef}` : parsed.user;
  const nextHost = poolerHost ?? parsed.host;
  const next = buildPostgresUrl({ ...parsed, user: nextUser, host: nextHost });
  return {
    next,
    changed: next !== raw,
    poolerHost: nextHost,
  };
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return null;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const values = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = line.indexOf("=");
    values.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  return { filePath, lines, values };
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function patchEnvFile(filePath) {
  const env = readEnvFile(filePath);
  if (!env) {
    return { filePath, changed: false, skipped: true };
  }

  const explicitPoolerHost = env.values.get("BACKEND_DATABASE_POOLER_HOST");
  const sourceUrl = stripQuotes(env.values.get("BACKEND_DATABASE_URL") ?? "");
  const parsedSource = sourceUrl ? parsePostgresUrl(sourceUrl) : null;
  const resolvedPoolerHost = parsedSource
    ? await resolvePoolerHost(parsedSource, explicitPoolerHost ? stripQuotes(explicitPoolerHost) : undefined)
    : undefined;

  let changed = false;
  let poolerHostWritten = false;
  const lines = env.lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return line;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    if (key === "BACKEND_DATABASE_POOLER_HOST") {
      if (!explicitPoolerHost && resolvedPoolerHost && parsedSource?.host.match(DIRECT_HOST_PATTERN)) {
        changed = true;
        poolerHostWritten = true;
        return `${key}=${resolvedPoolerHost}`;
      }
      return line;
    }
    if (!KEYS.includes(key) || key === "BACKEND_DATABASE_POOLER_HOST") return line;
    let value = stripQuotes(line.slice(index + 1).trim());
    const converted = convertPostgresUrl(value, resolvedPoolerHost);
    if (!converted.changed && key !== "BACKEND_DATABASE_URL") return line;
    if (converted.next === value && key !== "BACKEND_DATABASE_URL") return line;
    changed = true;
    return `${key}=${converted.next}`;
  });

  if (!explicitPoolerHost && resolvedPoolerHost && parsedSource?.host.match(DIRECT_HOST_PATTERN) && !poolerHostWritten) {
    lines.push(`BACKEND_DATABASE_POOLER_HOST=${resolvedPoolerHost}`);
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, `${lines.join("\n").replace(/\n?$/, "\n")}`, "utf8");
  }

  return { filePath, changed, skipped: false, poolerHost: resolvedPoolerHost };
}

const results = [];
for (const filePath of [backendEnv, rootEnvLocal]) {
  results.push(await patchEnvFile(filePath));
}

for (const result of results) {
  if (result.skipped) {
    console.log(`skip ${result.filePath} (missing)`);
    continue;
  }
  console.log(`${result.changed ? "updated" : "unchanged"} ${result.filePath}${result.poolerHost ? ` (pooler=${result.poolerHost})` : ""}`);
}
