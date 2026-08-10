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
    readonly password: string;
    readonly phone?: string;
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

export type DirectTenantAdminCreatedRow = TenantInvitationCreatedRow & {
  readonly membership_id: string;
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
  readonly administrator_membership_id?: string | null;
  readonly administrator_name?: string | null;
  readonly administrator_email?: string | null;
  readonly administrator_membership_status?: string | null;
  readonly administrator_last_login_at?: Date | null;
  readonly administrator_last_logout_at?: Date | null;
  readonly administrator_password_changed_at?: Date | null;
  // total_items is only present on list results (not single-tenant lookup).
  // pg returns bigint columns as strings, so we accept both.
  readonly total_items?: number | string;
};

export type TenantListFilterRow = {
  readonly country_code: string;
  readonly financial_year_label: string | null;
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
  readonly status: "active" | "suspended" | "revoked";
  readonly suspension_ends_at: Date | null;
  readonly revoked_at: Date | null;
};

export type TenantAdministratorAuthRow = {
  readonly user_id: string;
  readonly supabase_auth_user_id: string;
  readonly email: string;
};

type TenantAdministratorAccessRow = {
  readonly tenant_id: string;
  readonly membership_id: string | null;
  readonly administrator_name: string | null;
  readonly administrator_email: string | null;
  readonly membership_status: string | null;
  readonly last_login_at: Date | null;
  readonly last_logout_at: Date | null;
  readonly password_changed_at: Date | null;
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
          null,
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
      readonly countryCode?: string;
      readonly financialYear?: string;
      readonly sort?: string;
      readonly page: number;
      readonly pageSize: number;
    },
  ): Promise<TenantListRow[]> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantListRow>(
        `select *
         from private.list_super_admin_tenants_filtered(
           $1::text,
           $2::text,
           $3::date,
           $4::text,
           $5::text,
           $6::text,
           $7::integer,
           $8::integer
         )`,
        [
          input.query ?? null,
          input.status ?? null,
          input.createdAfter ?? null,
          input.countryCode ?? null,
          input.financialYear ?? null,
          input.sort ?? "name",
          input.pageSize,
          (input.page - 1) * input.pageSize,
        ],
      );
      return this.withTenantAdministratorAccess(client, result.rows);
    });
  }

  async getTenant(context: RequestContext, tenantId: string): Promise<TenantListRow | null> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantListRow>(
        `select *
         from private.get_super_admin_tenant($1::uuid)`,
        [tenantId],
      );
      return (await this.withTenantAdministratorAccess(client, result.rows))[0] ?? null;
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

  async createTenantWithDirectTenantAdministrator(
    context: RequestContext,
    input: CreateTenantWithOwnerInvitationInput,
    supabaseAuthUserId: string,
  ): Promise<DirectTenantAdminCreatedRow> {
    return this.withContext(context, async (client) => {
      const created = await client.query<TenantInvitationCreatedRow>(
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
          null,
        ],
      );
      const tenant = singleRow(created.rows);
      const accepted = await client.query<AcceptedInvitationRow>(
        "select * from private.accept_invitation($1::uuid, $2::uuid, $3::text, $4::text)",
        [tenant.invitation_id, supabaseAuthUserId, input.tenantAdministrator.email, input.tenantAdministrator.fullName],
      );
      const membership = singleRow(accepted.rows);
      await client.query("select private.set_direct_tenant_administrator_phone($1::uuid, $2::uuid, $3::text)", [
        tenant.tenant_id,
        membership.user_id,
        input.tenantAdministrator.phone,
      ]);
      await client.query("select private.activate_direct_tenant_admin_tenant($1::uuid)", [tenant.tenant_id]);
      return { ...tenant, membership_id: membership.membership_id };
    });
  }

  async userEmailExists(context: RequestContext, normalizedEmail: string): Promise<boolean> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ exists: boolean }>(
        "select private.user_email_exists($1::text) as exists",
        [normalizedEmail],
      );
      return result.rows[0]?.exists ?? false;
    });
  }

  async listTenantFilters(context: RequestContext): Promise<TenantListFilterRow[]> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantListFilterRow>(
        "select * from private.list_super_admin_tenant_list_filters()",
      );
      return result.rows;
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

  async activateDirectTenantAdminTenant(context: RequestContext, tenantId: string): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query("select private.activate_direct_tenant_admin_tenant($1::uuid)", [tenantId]);
    });
  }

  async setDirectTenantAdministratorPhone(
    context: RequestContext,
    tenantId: string,
    userId: string,
    phone: string,
  ): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query("select private.set_direct_tenant_administrator_phone($1::uuid, $2::uuid, $3::text)", [tenantId, userId, phone]);
    });
  }

  async getActiveTenantAdministrator(
    context: RequestContext,
    tenantId: string,
  ): Promise<TenantAdministratorAuthRow | null> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantAdministratorAuthRow>(
        `select u.id as user_id, u.supabase_auth_user_id, u.email
         from public.tenant_memberships tm
         join public.users u on u.id = tm.user_id
         join public.membership_roles mr
           on mr.tenant_id = tm.tenant_id
          and mr.membership_id = tm.id
          and mr.status = 'active'
         join public.roles r on r.id = mr.role_id and r.code = 'TENANT_ADMIN'
         where tm.tenant_id = $1::uuid
           and tm.status = 'active'
           and u.status = 'active'
         order by tm.joined_at asc
         limit 1`,
        [tenantId],
      );
      return result.rows[0] ?? null;
    });
  }

  async auditTenantAdministratorPasswordReset(
    context: RequestContext,
    tenantId: string,
    targetUserId: string,
    result: "requested" | "succeeded" | "failed",
  ): Promise<void> {
    await this.withContext(context, async (client) => {
      await client.query(
        `select audit.write_audit_event(
           $2::text,
           'tenant',
           $1::uuid,
           $3::text,
           null,
           jsonb_build_object('targetUserId', $4::uuid)
         )
         from (select set_config('app.tenant_id', $1::text, true)) as request_tenant`,
        [tenantId, `TENANT_ADMIN_PASSWORD_RESET_${result.toUpperCase()}`, result === "failed" ? "failed" : "succeeded", targetUserId],
      );
    });
  }

  async setTenantStatus(
    context: RequestContext,
    tenantId: string,
    status: "active" | "suspended" | "revoked",
    suspensionDuration?: string,
    reason?: string,
  ): Promise<TenantStatusRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<TenantStatusRow>(
        "select * from private.set_super_admin_tenant_lifecycle($1::uuid, $2::text, $3::text, $4::text)",
        [tenantId, status === "active" ? "reactivate" : status === "suspended" ? "suspend" : "revoke", suspensionDuration ?? null, reason ?? null],
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

  private async withTenantAdministratorAccess(
    client: PoolClient,
    rows: readonly TenantListRow[],
  ): Promise<TenantListRow[]> {
    if (!rows.length) return [];
    const result = await client.query<TenantAdministratorAccessRow>(
      "select * from private.list_super_admin_tenant_administrator_access($1::uuid[])",
      [rows.map((row) => row.id)],
    );
    const accessByTenant = new Map(result.rows.map((row) => [row.tenant_id, row]));
    return rows.map((row) => {
      const access = accessByTenant.get(row.id);
      return {
        ...row,
        administrator_membership_id: access?.membership_id ?? null,
        administrator_name: access?.administrator_name ?? null,
        administrator_email: access?.administrator_email ?? null,
        administrator_membership_status: access?.membership_status ?? null,
        administrator_last_login_at: access?.last_login_at ?? null,
        administrator_last_logout_at: access?.last_logout_at ?? null,
        administrator_password_changed_at: access?.password_changed_at ?? null,
      };
    });
  }
}

function singleRow<T>(rows: readonly T[]): T {
  if (!rows[0]) {
    throw new Error("Database mutation did not return a row.");
  }
  return rows[0];
}
