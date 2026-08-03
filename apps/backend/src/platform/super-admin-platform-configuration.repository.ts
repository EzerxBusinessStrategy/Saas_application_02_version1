import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { RequestContext } from "../auth/request-context";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { UpdatePlatformConfigurationRequest } from "./super-admin-platform-configuration.dto";

export type PlatformConfigurationRow = {
  readonly key: "platform_name" | "default_brand_colour" | "email_sender_name";
  readonly value: string;
};

@Injectable()
export class SuperAdminPlatformConfigurationRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async get(context: RequestContext): Promise<readonly PlatformConfigurationRow[]> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query<PlatformConfigurationRow>(
        `select key, value
         from public.platform_configurations
         order by key`,
      );
      return result.rows;
    });
  }

  async update(
    context: RequestContext,
    configuration: UpdatePlatformConfigurationRequest,
  ): Promise<readonly PlatformConfigurationRow[]> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const result = await client.query<PlatformConfigurationRow>(
        `insert into public.platform_configurations (key, value, updated_by_user_id, updated_at)
         values
           ('platform_name', $1::text, private.current_user_id(), now()),
           ('default_brand_colour', $2::text, private.current_user_id(), now()),
           ('email_sender_name', $3::text, private.current_user_id(), now())
         on conflict (key) do update
         set value = excluded.value,
             updated_by_user_id = private.current_user_id(),
             updated_at = now()
         returning key, value`,
        [configuration.platformName, configuration.defaultBrand.toUpperCase(), configuration.senderName],
      );
      await client.query(
        `select audit.write_audit_event(
           'PLATFORM_CONFIGURATION_UPDATED',
           'platform_configuration',
           null::uuid,
           'succeeded',
           null,
           $1::jsonb
         )`,
        [JSON.stringify({ updatedKeys: result.rows.map((row) => row.key) })],
      );
      return result.rows;
    });
  }
}
