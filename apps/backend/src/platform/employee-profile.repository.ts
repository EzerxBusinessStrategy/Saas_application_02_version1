import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured, forbiddenPortal } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { EmployeeRequestContext } from "./employee-context";

export type EmployeeProfileRow = {
  id: string;
  name: string;
  email: string;
  employee_code: string;
  tenant_name: string;
  role: string;
  status: string;
  department: string | null;
  experience_level: string | null;
  weekly_capacity_hours: string | null;
  work_groups: string[];
};

@Injectable()
export class EmployeeProfileRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async get(context: EmployeeRequestContext): Promise<EmployeeProfileRow> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => this.getForContext(client, context));
  }

  private async getForContext(client: PoolClient, context: EmployeeRequestContext): Promise<EmployeeProfileRow> {
    const result = await client.query<EmployeeProfileRow>(
      `
        select
          e.id::text,
          coalesce(tm.display_name, u.display_name, e.employee_code) as name,
          u.email,
          e.employee_code,
          t.display_name as tenant_name,
          'Employee' as role,
          e.employment_status as status,
          d.name as department,
          e.experience_level,
          case
            when e.default_capacity_minutes_per_week is null then null
            else round(e.default_capacity_minutes_per_week::numeric / 60, 1)::text
          end as weekly_capacity_hours,
          coalesce(array_remove(array_agg(distinct wg.name order by wg.name), null), '{}'::text[]) as work_groups
        from public.employees e
        join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id
        join public.users u on u.id = tm.user_id
        join public.tenants t on t.id = e.tenant_id
        left join public.departments d on d.tenant_id = e.tenant_id and d.id = e.department_id
        left join public.work_group_memberships wgm on wgm.tenant_id = e.tenant_id and wgm.employee_id = e.id and wgm.status = 'active'
        left join public.work_groups wg on wg.tenant_id = wgm.tenant_id and wg.id = wgm.work_group_id and wg.status = 'active'
        where e.tenant_id = $1
          and e.membership_id = $2
          and e.employment_status = 'active'
          and tm.status = 'active'
        group by e.id, tm.display_name, u.display_name, u.email, t.display_name, d.name
        limit 1
      `,
      [context.tenantId, context.membershipId],
    );
    const row = result.rows[0];
    if (!row) throw forbiddenPortal();
    return row;
  }
}
