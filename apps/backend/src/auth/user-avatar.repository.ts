import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { databaseNotConfigured } from "./auth-errors";
import { RequestContext } from "./request-context";

type AvatarPathRow = {
  readonly avatar_path: string | null;
};

@Injectable()
export class UserAvatarRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getPath(context: RequestContext): Promise<string | null> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query<AvatarPathRow>(
        `
        select avatar_path
        from public.users
        where id = $1::uuid
          and status = 'active'
        `,
        [context.userId],
      );
      return result.rows[0]?.avatar_path ?? null;
    });
  }

  async replacePath(context: RequestContext, nextPath: string | null): Promise<string | null> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const current = await client.query<AvatarPathRow>(
        `
        select avatar_path
        from public.users
        where id = $1::uuid
          and status = 'active'
        for update
        `,
        [context.userId],
      );
      const previousPath = current.rows[0]?.avatar_path ?? null;
      const updated = await client.query(
        `
        update public.users
        set avatar_path = $2,
            avatar_updated_at = case when $2::text is null then null else now() end,
            updated_at = now()
        where id = $1::uuid
          and status = 'active'
        `,
        [context.userId, nextPath],
      );
      if (updated.rowCount !== 1) {
        throw new Error("The authenticated profile photo could not be updated.");
      }
      await client.query(
        `
        select audit.write_audit_event(
          $2::text,
          'user',
          $1::uuid,
          'succeeded',
          null,
          jsonb_build_object('hadPreviousAvatar', $3::boolean)
        )
        `,
        [context.userId, nextPath ? "USER_AVATAR_UPDATED" : "USER_AVATAR_REMOVED", Boolean(previousPath)],
      );
      return previousPath;
    });
  }
}
