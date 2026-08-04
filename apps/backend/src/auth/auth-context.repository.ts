import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { setTrustedDatabaseContext } from "../database/transaction-context";
import { databaseNotConfigured } from "./auth-errors";

export type AuthContextRow = {
  readonly user_id: string;
  readonly user_email: string;
  readonly user_display_name: string;
  readonly user_status: string;
  readonly tenant_id: string | null;
  readonly tenant_code: string | null;
  readonly tenant_display_name: string | null;
  readonly tenant_status: string | null;
  readonly membership_id: string | null;
  readonly membership_status: string | null;
  readonly membership_display_name: string | null;
  readonly membership_timezone: string | null;
  readonly role_codes: readonly string[];
  readonly permission_codes: readonly string[];
};

@Injectable()
export class AuthContextRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) { }

  async findBySupabaseAuthUserId(authUserId: string): Promise<readonly AuthContextRow[]> {
    if (!this.pool) throw databaseNotConfigured();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await setTrustedDatabaseContext(client, { authUserId });
      await client.query("select private.restore_expired_tenant_suspensions()");
      const result = await client.query<AuthContextRow>(
        "select * from private.resolve_auth_context($1::uuid)",
        [authUserId],
      );
      await client.query("commit");
      return result.rows;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateDisplayName(userId: string, displayName: string): Promise<boolean> {
    if (!this.pool) throw databaseNotConfigured();
    const result = await this.pool.query(
      `
      update public.users
      set display_name = $2,
          updated_at = now()
      where id = $1
        and status = 'active'
      `,
      [userId, displayName],
    );
    return result.rowCount === 1;
  }
}
