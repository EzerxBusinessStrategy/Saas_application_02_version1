import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured, forbiddenPortal } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { setTrustedDatabaseContext, withDatabaseTransaction } from "../database/transaction-context";
import { EmployeeRequestContext } from "./employee-context";
import { publishTaskWorkflowNotification } from "./task-workflow-support";

type EmployeeRow = { id: string; name: string };
type TaskStatus = "open" | "assigned" | "in_progress" | "returned" | "submitted" | "manager_review" | "tenant_approval" | "approved" | "completed" | "cancelled";

export type EmployeeTaskRow = {
  id: string;
  title: string;
  description: string | null;
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  work_group_id: string | null;
  work_group_name: string | null;
  assigned_by: string | null;
  priority: string;
  status: TaskStatus;
  planned_due_at: Date | null;
  latest_manager_note: string | null;
  timer_status: "not_started" | "active" | "paused" | "submitted";
  worked_seconds: string;
  active_segment_started_at: Date | null;
  server_time: Date;
};

export type EmployeeWorkLogRow = {
  date: string;
  task_id: string;
  task_title: string;
  client_name: string;
  worked_seconds: string;
  segments: readonly { startedAt: string; endedAt: string | null; workedSeconds: number }[];
};

@Injectable()
export class EmployeeTasksRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async listTasks(context: EmployeeRequestContext): Promise<readonly EmployeeTaskRow[]> {
    return this.withEmployee(context, (client, employee) => this.queryTasks(client, context.tenantId, employee.id));
  }

  async listWorkLogs(context: EmployeeRequestContext): Promise<readonly EmployeeWorkLogRow[]> {
    return this.withEmployee(context, async (client, employee) => {
      const result = await client.query<EmployeeWorkLogRow>(
        `
          select
            to_char(tws.started_at at time zone 'UTC', 'YYYY-MM-DD') as date,
            t.id::text as task_id,
            t.title as task_title,
            c.display_name as client_name,
            sum(extract(epoch from (coalesce(tws.ended_at, clock_timestamp()) - tws.started_at)))::bigint::text as worked_seconds,
            jsonb_agg(
              jsonb_build_object(
                'startedAt', tws.started_at,
                'endedAt', tws.ended_at,
                'workedSeconds', extract(epoch from (coalesce(tws.ended_at, clock_timestamp()) - tws.started_at))::int
              )
              order by tws.started_at
            ) as segments
          from public.task_work_segments tws
          join public.tasks t on t.tenant_id = tws.tenant_id and t.id = tws.task_id
          join public.clients c on c.tenant_id = t.tenant_id and c.id = t.client_id
          where tws.tenant_id = $1
            and tws.employee_id = $2
          group by date, t.id, t.title, c.display_name
          order by date desc, max(tws.started_at) desc
          limit 100
        `,
        [context.tenantId, employee.id],
      );
      return result.rows;
    });
  }

  async start(context: EmployeeRequestContext, taskId: string): Promise<EmployeeTaskRow> {
    return this.withEmployee(context, async (client, employee) => {
      await this.lockEmployee(client, context.tenantId, employee.id);
      await this.assertOwnedTask(client, context.tenantId, employee.id, taskId, ["open", "assigned", "returned"]);
      await this.assertNoActiveSegment(client, context.tenantId, employee.id);
      const sessionId = await this.createSession(client, context.tenantId, taskId, employee.id);
      await client.query(
        "insert into public.task_work_segments (tenant_id, task_id, employee_id, work_session_id) values ($1, $2, $3, $4)",
        [context.tenantId, taskId, employee.id, sessionId],
      );
      await client.query(
        "update public.tasks set status = 'in_progress', actual_started_at = coalesce(actual_started_at, clock_timestamp()), updated_by = $3, updated_at = now() where tenant_id = $1 and id = $2",
        [context.tenantId, taskId, context.membershipId],
      );
      await this.audit(client, "TASK_STARTED", taskId, { employeeId: employee.id });
      return this.getTask(client, context.tenantId, employee.id, taskId);
    });
  }

  async pause(context: EmployeeRequestContext, taskId: string): Promise<EmployeeTaskRow> {
    return this.withEmployee(context, async (client, employee) => {
      await this.lockEmployee(client, context.tenantId, employee.id);
      await this.assertOwnedTask(client, context.tenantId, employee.id, taskId, ["in_progress"]);
      const closed = await this.closeActiveSegment(client, context.tenantId, taskId, employee.id);
      await client.query(
        "update public.task_work_sessions set status = 'paused', updated_at = now() where tenant_id = $1 and id = $2",
        [context.tenantId, closed.work_session_id],
      );
      await this.audit(client, "TASK_PAUSED", taskId, {
        employeeId: employee.id,
        segmentSeconds: closed.segment_seconds,
        totalWorkedSeconds: await this.workedSeconds(client, context.tenantId, taskId, employee.id),
      });
      return this.getTask(client, context.tenantId, employee.id, taskId);
    });
  }

  async resume(context: EmployeeRequestContext, taskId: string): Promise<EmployeeTaskRow> {
    return this.withEmployee(context, async (client, employee) => {
      await this.lockEmployee(client, context.tenantId, employee.id);
      await this.assertOwnedTask(client, context.tenantId, employee.id, taskId, ["in_progress"]);
      await this.assertNoActiveSegment(client, context.tenantId, employee.id);
      const session = await client.query<{ id: string }>(
        "select id::text from public.task_work_sessions where tenant_id = $1 and task_id = $2 and employee_id = $3 and status = 'paused' order by updated_at desc limit 1 for update",
        [context.tenantId, taskId, employee.id],
      );
      const sessionId = session.rows[0]?.id;
      if (!sessionId) throw new ConflictException({ code: "TASK_TIMER_NOT_PAUSED", message: "This task is not paused." });
      await client.query("update public.task_work_sessions set status = 'active', updated_at = now() where tenant_id = $1 and id = $2", [context.tenantId, sessionId]);
      await client.query(
        "insert into public.task_work_segments (tenant_id, task_id, employee_id, work_session_id) values ($1, $2, $3, $4)",
        [context.tenantId, taskId, employee.id, sessionId],
      );
      await this.audit(client, "TASK_RESUMED", taskId, { employeeId: employee.id });
      return this.getTask(client, context.tenantId, employee.id, taskId);
    });
  }

  async submit(context: EmployeeRequestContext, taskId: string, taskComment: string): Promise<EmployeeTaskRow> {
    return this.withEmployee(context, async (client, employee) => {
      await this.lockEmployee(client, context.tenantId, employee.id);
      await this.assertOwnedTask(client, context.tenantId, employee.id, taskId, ["in_progress"]);
      const open = await this.findActiveSegment(client, context.tenantId, taskId, employee.id);
      if (open) await this.closeActiveSegment(client, context.tenantId, taskId, employee.id);
      await client.query(
        "update public.task_work_sessions set status = 'completed', completed_at = clock_timestamp(), updated_at = now() where tenant_id = $1 and task_id = $2 and employee_id = $3 and status in ('active', 'paused')",
        [context.tenantId, taskId, employee.id],
      );
      await client.query(
        "update public.task_assignments set status = 'submitted', updated_at = now() where tenant_id = $1 and task_id = $2 and employee_id = $3",
        [context.tenantId, taskId, employee.id],
      );
      await client.query(
        "update public.tasks set status = 'manager_review', updated_by = $3, updated_at = now() where tenant_id = $1 and id = $2",
        [context.tenantId, taskId, context.membershipId],
      );
      const submission = await client.query<{ id: string }>(
        `
          insert into public.task_submissions (tenant_id, task_id, employee_id, submitted_by, status, remarks, task_comment)
          values ($1, $2, $3, $4, 'submitted', nullif($5, ''), nullif($5, ''))
          returning id::text
        `,
        [context.tenantId, taskId, employee.id, context.membershipId, taskComment],
      );
      const submissionId = submission.rows[0]?.id;
      if (!submissionId) {
        throw new ConflictException({ code: "TASK_SUBMISSION_CREATE_FAILED", message: "The task could not be submitted for review." });
      }
      await this.audit(client, "TASK_SUBMITTED", taskId, {
        employeeId: employee.id,
        totalWorkedSeconds: await this.workedSeconds(client, context.tenantId, taskId, employee.id),
        taskComment: taskComment || null,
      });
      const task = await this.getTask(client, context.tenantId, employee.id, taskId);
      await publishTaskWorkflowNotification(client, {
        tenantId: context.tenantId,
        actorUserId: context.userId,
        taskId,
        employeeId: employee.id,
        audience: "managers",
        type: "TASK_SUBMITTED_FOR_MANAGER_REVIEW",
        title: "Task ready for review",
        message: `An employee submitted "${task.title}" for your review.`,
        actionUrl: "/employee/task-reviews",
        eventKey: `task-submitted-manager-review:${submissionId}`,
      });
      return task;
    });
  }

  private async queryTasks(client: PoolClient, tenantId: string, employeeId: string): Promise<readonly EmployeeTaskRow[]> {
    const result = await client.query<EmployeeTaskRow>(
      `
        with segment_totals as (
          select
            tenant_id,
            task_id,
            employee_id,
            coalesce(sum(extract(epoch from (coalesce(ended_at, clock_timestamp()) - started_at))), 0)::bigint::text as worked_seconds,
            min(started_at) filter (where ended_at is null) as active_segment_started_at
          from public.task_work_segments
          where tenant_id = $1 and employee_id = $2
          group by tenant_id, task_id, employee_id
        ),
        latest_session as (
          select distinct on (tenant_id, task_id, employee_id)
            tenant_id,
            task_id,
            employee_id,
            status
          from public.task_work_sessions
          where tenant_id = $1 and employee_id = $2
          order by tenant_id, task_id, employee_id, updated_at desc
        )
        select
          t.id::text,
          t.title,
          t.description,
          t.client_id::text,
          c.display_name as client_name,
          t.service_id::text,
          s.name as service_name,
          t.work_group_id::text,
          wg.name as work_group_name,
          coalesce(assigned_by.display_name, created_by.display_name) as assigned_by,
          t.priority,
          t.status,
          t.planned_due_at,
          returned.latest_manager_note,
          coalesce(
            case
              when st.active_segment_started_at is not null then 'active'
              when ls.status = 'paused' then 'paused'
              when t.status in ('submitted', 'manager_review', 'tenant_approval', 'approved', 'completed') then 'submitted'
              else ls.status
            end,
            'not_started'
          ) as timer_status,
          coalesce(st.worked_seconds, '0') as worked_seconds,
          st.active_segment_started_at,
          clock_timestamp() as server_time
        from public.task_assignments ta
        join public.tasks t on t.tenant_id = ta.tenant_id and t.id = ta.task_id
        join public.clients c on c.tenant_id = t.tenant_id and c.id = t.client_id
        join public.services s on s.tenant_id = t.tenant_id and s.id = t.service_id
        left join public.work_groups wg on wg.tenant_id = t.tenant_id and wg.id = t.work_group_id
        left join public.tenant_memberships assigned_by on assigned_by.tenant_id = ta.tenant_id and assigned_by.id = ta.assigned_by
        left join public.tenant_memberships created_by on created_by.tenant_id = t.tenant_id and created_by.id = t.created_by
        left join segment_totals st on st.tenant_id = ta.tenant_id and st.task_id = ta.task_id and st.employee_id = ta.employee_id
        left join latest_session ls on ls.tenant_id = ta.tenant_id and ls.task_id = ta.task_id and ls.employee_id = ta.employee_id
        left join lateral (
          select a.remarks as latest_manager_note
          from public.approvals a
          where a.tenant_id = t.tenant_id and a.task_id = t.id and a.decision in ('returned', 'rejected')
          order by a.decided_at desc
          limit 1
        ) returned on true
        where ta.tenant_id = $1
          and ta.employee_id = $2
          and ta.status in ('active', 'submitted')
          and t.status <> 'cancelled'
        order by
          case when t.status = 'returned' then 0 when t.status = 'in_progress' then 1 else 2 end,
          t.planned_due_at asc nulls last,
          t.created_at desc
      `,
      [tenantId, employeeId],
    );
    return result.rows;
  }

  private async getTask(client: PoolClient, tenantId: string, employeeId: string, taskId: string): Promise<EmployeeTaskRow> {
    const task = (await this.queryTasks(client, tenantId, employeeId)).find((row) => row.id === taskId);
    if (!task) throw forbiddenPortal();
    return task;
  }

  private async getEmployee(client: PoolClient, context: EmployeeRequestContext): Promise<EmployeeRow> {
    const result = await client.query<EmployeeRow>(
      `
        select e.id::text, coalesce(tm.display_name, e.employee_code) as name
        from public.employees e
        join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id
        where e.tenant_id = $1 and e.membership_id = $2 and e.employment_status = 'active'
        limit 1
      `,
      [context.tenantId, context.membershipId],
    );
    const employee = result.rows[0];
    if (!employee) throw forbiddenPortal();
    return employee;
  }

  private async assertOwnedTask(client: PoolClient, tenantId: string, employeeId: string, taskId: string, statuses: readonly string[]) {
    const result = await client.query(
      `
        select 1
        from public.task_assignments ta
        join public.tasks t on t.tenant_id = ta.tenant_id and t.id = ta.task_id
        where ta.tenant_id = $1
          and ta.employee_id = $2
          and ta.task_id = $3
          and ta.status in ('active', 'submitted')
          and t.status = any($4::text[])
        for update of ta, t
      `,
      [tenantId, employeeId, taskId, statuses],
    );
    if (!result.rowCount) throw new ConflictException({ code: "TASK_ACTION_NOT_ALLOWED", message: "This task cannot be changed from its current state." });
  }

  private async createSession(client: PoolClient, tenantId: string, taskId: string, employeeId: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      "insert into public.task_work_sessions (tenant_id, task_id, employee_id) values ($1, $2, $3) returning id::text",
      [tenantId, taskId, employeeId],
    );
    return result.rows[0]!.id;
  }

  private async findActiveSegment(client: PoolClient, tenantId: string, taskId: string, employeeId: string) {
    const result = await client.query<{ id: string }>(
      "select id::text from public.task_work_segments where tenant_id = $1 and task_id = $2 and employee_id = $3 and ended_at is null limit 1",
      [tenantId, taskId, employeeId],
    );
    return result.rows[0] ?? null;
  }

  private async closeActiveSegment(client: PoolClient, tenantId: string, taskId: string, employeeId: string) {
    const result = await client.query<{ work_session_id: string; segment_seconds: number }>(
      `
        update public.task_work_segments
        set ended_at = clock_timestamp()
        where tenant_id = $1 and task_id = $2 and employee_id = $3 and ended_at is null
        returning work_session_id::text, extract(epoch from (ended_at - started_at))::int as segment_seconds
      `,
      [tenantId, taskId, employeeId],
    );
    const closed = result.rows[0];
    if (!closed) throw new ConflictException({ code: "TASK_TIMER_NOT_ACTIVE", message: "This task timer is not active." });
    return closed;
  }

  private async workedSeconds(client: PoolClient, tenantId: string, taskId: string, employeeId: string): Promise<number> {
    const result = await client.query<{ worked_seconds: string }>(
      `
        select coalesce(sum(extract(epoch from (coalesce(ended_at, clock_timestamp()) - started_at))), 0)::bigint::text as worked_seconds
        from public.task_work_segments
        where tenant_id = $1 and task_id = $2 and employee_id = $3
      `,
      [tenantId, taskId, employeeId],
    );
    return Number(result.rows[0]?.worked_seconds ?? 0);
  }

  private async assertNoActiveSegment(client: PoolClient, tenantId: string, employeeId: string): Promise<void> {
    const result = await client.query<{ task_id: string }>(
      "select task_id::text from public.task_work_segments where tenant_id = $1 and employee_id = $2 and ended_at is null limit 1",
      [tenantId, employeeId],
    );
    if (result.rows[0]) {
      throw new ConflictException({
        code: "EMPLOYEE_ACTIVE_TIMER_EXISTS",
        message: "You already have an active task. Pause it before starting another task.",
      });
    }
  }

  private async lockEmployee(client: PoolClient, tenantId: string, employeeId: string): Promise<void> {
    await client.query("select id from public.employees where tenant_id = $1 and id = $2 for update", [tenantId, employeeId]);
  }

  private async audit(client: PoolClient, action: string, taskId: string, metadata: Record<string, unknown>): Promise<void> {
    await client.query(
      "select audit.write_audit_event($1, 'task', $2::uuid, 'succeeded', null, $3::jsonb)",
      [action, taskId, JSON.stringify(metadata)],
    );
  }

  private async withEmployee<T>(
    context: EmployeeRequestContext,
    work: (client: PoolClient, employee: EmployeeRow) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const employee = await this.getEmployee(client, context);
      await setTrustedDatabaseContext(client, { ...context, employeeId: employee.id });
      return work(client, employee);
    });
  }
}
