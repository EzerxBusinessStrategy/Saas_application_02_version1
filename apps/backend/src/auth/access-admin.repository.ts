import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { databaseNotConfigured } from "./auth-errors";
import { RequestContext, VerifiedAuthUser } from "./request-context";

export type CreateTenantWithOwnerInvitationInput = {
  readonly company: {
    readonly displayName: string;
    readonly legalName: string;
    readonly tenantCode: string;
    readonly slug: string;
    readonly countryCode: string;
    readonly reportingCurrencyCode: string;
    readonly timezone: string;
    readonly industry?: string;
    readonly registrationNumber?: string;
    readonly taxIdentifier?: string;
  };
  readonly financialYear: {
    readonly source: "COUNTRY_SUGGESTION_CONFIRMED" | "CUSTOM_CONFIRMED";
    readonly label: string;
    readonly startsOn: string;
    readonly endsOn: string;
    readonly templateId?: string;
    readonly overrideReason?: string;
  };
  readonly tenantAdministrator: {
    readonly fullName: string;
    readonly email: string;
    readonly phone?: string;
    readonly expiresAt?: string;
  };
};

export type CreateInvitationInput = {
  readonly email: string;
  readonly displayName?: string;
  readonly roleCode: string;
  readonly expiresAt?: string;
};

export type TenantInvitationCreatedRow = {
  readonly tenant_id: string;
  readonly financial_year_id: string;
  readonly invitation_id: string;
};

export type TenantCreationTemplateRow = {
  readonly id: string;
  readonly country_code: string;
  readonly name: string;
  readonly policy_mode: string;
  readonly start_month: number;
  readonly start_day: number;
  readonly end_month: number;
  readonly end_day: number;
  readonly confirmation_required: boolean;
  readonly custom_allowed: boolean;
  readonly maximum_period_days: number | null;
  readonly supports_52_53_week: boolean;
  readonly metadata: {
    readonly defaultCurrency?: string;
    readonly defaultTimezone?: string;
    readonly suggestedYearEnds?: string[];
    readonly guidance?: string;
  };
};

export type TenantListRow = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly owner_name: string | null;
  readonly owner_email: string | null;
  readonly pending_invitation_id: string | null;
  readonly status: string;
  readonly employee_count: number;
  readonly client_count: number;
  readonly created_at: Date;
  readonly usage_percent: number;
  // total_items is only present on list results (not single-tenant lookup).
  // pg returns bigint columns as strings, so we accept both.
  readonly total_items?: number | string;
};

export type InvitationCreatedRow = {
  readonly invitation_id: string;
  readonly role_code: string;
  readonly status: string;
  readonly expires_at: Date;
};

export type ClosedInvitationRow = {
  readonly invitation_id: string;
  readonly status: "cancelled" | "revoked";
};

export type InvitationDeliveryStatus = "not_sent" | "sent" | "failed";

export type AcceptedInvitationRow = {
  readonly tenant_id: string;
  readonly user_id: string;
  readonly membership_id: string;
  readonly role_code: string;
  readonly status: "active";
};

export type MembershipAccessRow = {
  readonly membership_id: string;
  readonly role_code?: string;
  readonly status: "active" | "revoked";
};

export type TenantStatusRow = {
  readonly tenant_id: string;
  readonly status: "active" | "suspended";
};

@Injectable()
export class AccessAdminRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) { }

  async createTenantWithOwnerInvitation(
    context: RequestContext,
    input: CreateTenantWithOwnerInvitationInput,
  ): Promise<TenantInvitationCreatedRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantInvitationCreatedRow>(
        `select *
         from private.create_super_admin_tenant(
           $1::text, $2::text, $3::text, $4::text, $5::text,
           $6::text, $7::text, $8::text, $9::text, $10::text,
           $11::text, $12::text, $13::date, $14::date, $15::uuid,
           $16::text, $17::text, $18::text, $19::text, $20::timestamptz
         )`,
        [
          input.company.displayName,
          input.company.legalName,
          input.company.tenantCode,
          input.company.slug,
          input.company.countryCode,
          input.company.reportingCurrencyCode,
          input.company.timezone,
          input.company.industry ?? null,
          input.company.registrationNumber ?? null,
          input.company.taxIdentifier ?? null,
          input.financialYear.source,
          input.financialYear.label,
          input.financialYear.startsOn,
          input.financialYear.endsOn,
          input.financialYear.templateId ?? null,
          input.financialYear.overrideReason ?? null,
          input.tenantAdministrator.fullName,
          input.tenantAdministrator.email,
          input.tenantAdministrator.phone ?? null,
          input.tenantAdministrator.expiresAt ?? null,
        ],
      );
      return singleRow(result.rows);
    });
  }

  async listTenantCreationTemplates(context: RequestContext): Promise<TenantCreationTemplateRow[]> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantCreationTemplateRow>(
        `select id, country_code, name, policy_mode, start_month, start_day, end_month, end_day,
                confirmation_required, custom_allowed, maximum_period_days, supports_52_53_week, metadata
         from public.financial_year_templates
         where is_active
         order by case country_code when 'IN' then 0 else 1 end, country_code`,
      );
      return result.rows;
    });
  }

  async listTenants(
    context: RequestContext,
    input: {
      readonly query?: string;
      readonly status?: string;
      readonly createdAfter?: string;
      readonly sort?: string;
      readonly page: number;
      readonly pageSize: number;
    },
  ): Promise<TenantListRow[]> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantListRow>(
        `select *
         from private.list_super_admin_tenants(
           $1::text,
           $2::text,
           $3::date,
           $4::text,
           $5::integer,
           $6::integer
         )`,
        [
          input.query ?? null,
          input.status ?? null,
          input.createdAfter ?? null,
          input.sort ?? "name",
          input.pageSize,
          (input.page - 1) * input.pageSize,
        ],
      );
      return result.rows;
    });
  }

  async getTenant(context: RequestContext, tenantId: string): Promise<TenantListRow | null> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantListRow>(
        `select *
         from private.get_super_admin_tenant($1::uuid)`,
        [tenantId],
      );
      return result.rows[0] ?? null;
    });
  }

  async createInvitation(
    context: RequestContext,
    input: CreateInvitationInput,
  ): Promise<InvitationCreatedRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<InvitationCreatedRow>(
        `select *
         from private.create_invitation($1::text, $2::text, $3::text, $4::timestamptz)`,
        [input.email, input.displayName ?? null, input.roleCode, input.expiresAt ?? null],
      );
      return singleRow(result.rows);
    });
  }

  async closeInvitation(
    context: RequestContext,
    invitationId: string,
    status: "cancelled" | "revoked",
    reason?: string,
  ): Promise<ClosedInvitationRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<ClosedInvitationRow>(
        "select * from private.close_invitation($1::uuid, $2::text, $3::text)",
        [invitationId, status, reason ?? null],
      );
      return singleRow(result.rows);
    });
  }

  async cancelPendingTenantAdminInvitation(
    context: RequestContext,
    tenantId: string,
    reason?: string,
  ): Promise<ClosedInvitationRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<ClosedInvitationRow>(
        "select * from private.cancel_super_admin_tenant_invitation($1::uuid, $2::text)",
        [tenantId, reason ?? null],
      );
      return singleRow(result.rows);
    });
  }

  async markInvitationDelivery(
    context: RequestContext,
    invitationId: string,
    status: InvitationDeliveryStatus,
    supabaseInvitationId?: string,
  ): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query(
        `update public.invitations
         set delivery_status = $2::text,
             supabase_invitation_id = coalesce($3::text, supabase_invitation_id),
             updated_at = now()
         where id = $1::uuid`,
        [invitationId, status, supabaseInvitationId ?? null],
      );
    });
  }

  async acceptInvitation(
    verifiedUser: VerifiedAuthUser,
    invitationId: string,
    displayName?: string,
  ): Promise<AcceptedInvitationRow> {
    if (!this.pool) throw databaseNotConfigured();
    const result = await this.pool.query<AcceptedInvitationRow>(
      "select * from private.accept_invitation($1::uuid, $2::uuid, $3::text, $4::text)",
      [invitationId, verifiedUser.authUserId, verifiedUser.email, displayName ?? null],
    );
    return singleRow(result.rows);
  }

  async revokeMembership(
    context: RequestContext,
    membershipId: string,
    reason: string,
  ): Promise<MembershipAccessRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<MembershipAccessRow>(
        "select * from private.revoke_membership($1::uuid, $2::text)",
        [membershipId, reason],
      );
      return singleRow(result.rows);
    });
  }

  async reactivateMembership(
    context: RequestContext,
    membershipId: string,
    roleCode: string,
  ): Promise<MembershipAccessRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<MembershipAccessRow>(
        "select * from private.reactivate_membership($1::uuid, $2::text)",
        [membershipId, roleCode],
      );
      return singleRow(result.rows);
    });
  }

  async setTenantStatus(
    context: RequestContext,
    tenantId: string,
    status: "active" | "suspended",
    reason?: string,
  ): Promise<TenantStatusRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantStatusRow>(
        "select * from private.set_super_admin_tenant_status($1::uuid, $2::text, $3::text)",
        [tenantId, status, reason ?? null],
      );
      return singleRow(result.rows);
    });
  }

  private async withContext<T>(
    context: RequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}

function singleRow<T>(rows: readonly T[]): T {
  if (!rows[0]) {
    throw new Error("Database mutation did not return a row.");
  }
  return rows[0];
}
