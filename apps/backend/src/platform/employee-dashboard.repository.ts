import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured, forbiddenPortal } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { setTrustedDatabaseContext, withDatabaseTransaction } from "../database/transaction-context";
import { EmployeeRequestContext } from "./employee-context";

type EmployeeRow = {
  id: string;
  name: string;
};

export type EmployeeDashboardTaskRow = {
  id: string;
  title: string;
  description: string | null;
  client_name: string;
  service_name: string;
  status: string;
  planned_due_at: Date | null;
  due_today: boolean;
  latest_manager_note: string | null;
};

@Injectable()
export class EmployeeDashboardRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async read(context: EmployeeRequestContext) {
    return this.withContext(context, async (client) => {
      const employee = await this.getEmployee(client, context);
      const scopedContext = { ...context, employeeId: employee.id };
      await setTrustedDatabaseContext(client, scopedContext);
      return {
        employee,
        tasks: await this.getAssignedTasks(client, scopedContext),
        workLog: { loggedMinutes: 0, status: "not_started" as const },
      };
    });
  }

  private async getEmployee(client: PoolClient, context: EmployeeRequestContext): Promise<EmployeeRow> {
    const result = await client.query<EmployeeRow>(
      `
        select e.id::text, coalesce(tm.display_name, e.employee_code) as name
        from public.employees e
        join public.tenant_memberships tm
          on tm.id = e.membership_id
         and tm.tenant_id = e.tenant_id
        where e.tenant_id = $1
          and e.membership_id = $2
          and e.employment_status = 'active'
        limit 1
      `,
      [context.tenantId, context.membershipId],
    );
    const employee = result.rows[0];
    if (!employee) throw forbiddenPortal();
    return employee;
  }

  private async getAssignedTasks(
    client: PoolClient,
    context: EmployeeRequestContext & { readonly employeeId: string },
  ): Promise<readonly EmployeeDashboardTaskRow[]> {
    const result = await client.query<EmployeeDashboardTaskRow>(
      `
        with assigned_tasks as (
          select
            t.id,
            t.tenant_id,
            t.title,
            t.description,
            t.client_id,
            t.service_id,
            t.status,
            t.planned_due_at,
            t.created_at
          from public.task_assignments ta
          join public.tasks t
            on t.id = ta.task_id
           and t.tenant_id = ta.tenant_id
          where ta.tenant_id = $1
            and ta.employee_id = $2
            and ta.status = 'active'
            and t.status not in ('approved', 'completed', 'cancelled')
        )
        select
          at.id::text,
          at.title,
          at.description,
          c.display_name as client_name,
          s.name as service_name,
          at.status,
          at.planned_due_at,
          (at.planned_due_at::date = current_date) as due_today,
          returned.latest_manager_note
        from assigned_tasks at
        join public.clients c
          on c.id = at.client_id
         and c.tenant_id = at.tenant_id
        join public.services s
          on s.id = at.service_id
         and s.tenant_id = at.tenant_id
        left join lateral (
          select a.remarks as latest_manager_note
          from public.approvals a
          where a.tenant_id = at.tenant_id
            and a.task_id = at.id
            and a.decision in ('returned', 'rejected')
          order by a.decided_at desc
          limit 1
        ) returned on true
        order by
          case when at.status = 'returned' then 0 else 1 end,
          case when at.status = 'in_progress' then 0 else 1 end,
          at.planned_due_at asc nulls last,
          at.created_at desc
        limit 25
      `,
      [context.tenantId, context.employeeId],
    );
    return result.rows;
  }

  private async withContext<T>(
    context: EmployeeRequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return withDatabaseTransaction(this.poolOrThrow(), context, (_tx, client) => work(client));
  }

  private poolOrThrow(): Pool {
    if (!this.pool) throw databaseNotConfigured();
    return this.pool;
  }
}
