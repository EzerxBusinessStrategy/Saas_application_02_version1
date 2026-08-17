import { describe, expect, test } from "vitest";
import {
  createPostgresPoolConfig,
  isSupabaseRemoteDatabaseHost,
  normalizeSupabaseDatabaseUrl,
} from "../../src/database/postgres-connection";

describe("postgres-connection", () => {
  test("normalizes direct Supabase URLs to the configured pooler host", () => {
    const direct =
      "postgresql://postgres:secret@db.cndvtmggevbcgbegolkk.supabase.co:5432/postgres";
    const normalized = normalizeSupabaseDatabaseUrl(
      direct,
      "aws-1-ap-northeast-2.pooler.supabase.com",
    );

    expect(normalized).toBe(
      "postgresql://postgres.cndvtmggevbcgbegolkk:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
    );
  });

  test("enables SSL for Supabase pooler hosts", () => {
    const config = createPostgresPoolConfig(
      "postgresql://postgres.cndvtmggevbcgbegolkk:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
    );

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(isSupabaseRemoteDatabaseHost("aws-1-ap-northeast-2.pooler.supabase.com")).toBe(true);
  });
});
