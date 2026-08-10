import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { databaseNotConfigured } from "./auth-errors";

@Injectable()
export class AuthIdentifyService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async identifyEmail(email: string): Promise<{ method: "password"; displayName?: string }> {
    if (!this.pool) throw databaseNotConfigured();
    const result = await this.pool.query<{ display_name: string | null }>(
      "select display_name from private.identify_login_email($1::text)",
      [email.trim().toLowerCase()],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "EMAIL_NOT_FOUND",
        message: "No account found for this email.",
      });
    }
    return { method: "password", displayName: row.display_name ?? undefined };
  }
}
