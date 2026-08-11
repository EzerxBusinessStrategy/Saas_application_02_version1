import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { databaseNotConfigured } from "./auth-errors";
import { RequestContext } from "./request-context";
import { AppLocale, AppTimezone, UserPreferences } from "./user-preferences.types";

type PreferenceRow = {
  readonly locale: AppLocale;
  readonly timezone: AppTimezone;
};

@Injectable()
export class UserPreferencesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async getOrCreate(context: RequestContext): Promise<UserPreferences> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      await client.query(
        `
        insert into public.user_preferences (user_id)
        values ($1::uuid)
        on conflict (user_id) do nothing
        `,
        [context.userId],
      );
      const result = await client.query<PreferenceRow>(
        `
        select locale, timezone
        from public.user_preferences
        where user_id = $1::uuid
        `,
        [context.userId],
      );
      const preference = result.rows[0];
      if (!preference) throw new Error("Current user preferences could not be resolved.");
      return preference;
    });
  }

  async update(
    context: RequestContext,
    input: UserPreferences,
  ): Promise<UserPreferences> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query<PreferenceRow>(
        `
        insert into public.user_preferences (user_id, locale, timezone)
        values ($1::uuid, $2, $3)
        on conflict (user_id) do update
        set locale = excluded.locale,
            timezone = excluded.timezone,
            updated_at = now()
        returning locale, timezone
        `,
        [context.userId, input.locale, input.timezone],
      );
      const preference = result.rows[0];
      if (!preference) throw new Error("Current user preferences could not be updated.");
      return preference;
    });
  }
}
