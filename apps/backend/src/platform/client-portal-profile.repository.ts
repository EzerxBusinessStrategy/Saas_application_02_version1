import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { ClientPortalRequestContext } from "./client-portal-context";
import { UpdateClientPortalProfile } from "./client-portal-profile.dto";

type ProfileRow = {
  portal_name: string | null;
  primary_colour: string | null;
  sidebar_colour: string | null;
  surface_colour: string | null;
};

@Injectable()
export class ClientPortalProfileRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async read(context: ClientPortalRequestContext): Promise<ProfileRow> {
    return this.withContext(context, (client) => this.getProfile(client, context));
  }

  async update(context: ClientPortalRequestContext, input: UpdateClientPortalProfile): Promise<ProfileRow> {
    return this.withContext(context, async (client) => {
      try {
        const result = await client.query<ProfileRow>(
          `
            update public.client_portal_accounts
            set
              portal_name = $4,
              primary_colour = $5,
              sidebar_colour = $6,
              surface_colour = $7,
              updated_at = now()
            where tenant_id = $1
              and id = $2
              and user_id = $3
              and status = 'active'
            returning portal_name, primary_colour, sidebar_colour, surface_colour
          `,
          [
            context.tenantId,
            context.clientAccountId,
            context.userId,
            input.portalName,
            input.primaryColour,
            input.sidebarColour,
            input.surfaceColour,
          ],
        );
        if (!result.rows[0]) throw new NotFoundException("Client profile not found.");
        return result.rows[0];
      } catch (error) {
        if (isUndefinedColumn(error)) {
          throw new BadRequestException("Run migration 0044_client_portal_profile_preferences.sql before saving profile.");
        }
        throw error;
      }
    });
  }

  private async getProfile(client: PoolClient, context: ClientPortalRequestContext): Promise<ProfileRow> {
    try {
      const result = await client.query<ProfileRow>(
        `
          select portal_name, primary_colour, sidebar_colour, surface_colour
          from public.client_portal_accounts
          where tenant_id = $1
            and id = $2
            and user_id = $3
            and status = 'active'
        `,
        [context.tenantId, context.clientAccountId, context.userId],
      );
      if (!result.rows[0]) throw new NotFoundException("Client profile not found.");
      return result.rows[0];
    } catch (error) {
      if (!isUndefinedColumn(error)) throw error;
      const account = await client.query<{ exists: boolean }>(
        `
          select exists (
            select 1
            from public.client_portal_accounts
            where tenant_id = $1
              and id = $2
              and user_id = $3
              and status = 'active'
          ) as exists
        `,
        [context.tenantId, context.clientAccountId, context.userId],
      );
      if (!account.rows[0]?.exists) throw new NotFoundException("Client profile not found.");
      return { portal_name: null, primary_colour: null, sidebar_colour: null, surface_colour: null };
    }
  }

  private async withContext<T>(context: ClientPortalRequestContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function isUndefinedColumn(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42703";
}
