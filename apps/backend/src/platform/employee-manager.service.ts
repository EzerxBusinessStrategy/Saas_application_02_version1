import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { RequestContext } from "../auth/request-context";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { setTrustedDatabaseContext, withDatabaseTransaction } from "../database/transaction-context";
import { TenantAdminTasksRepository } from "./tenant-admin-tasks.repository";
import { publishTaskWorkflowNotification, resumeReturnedTaskTimer } from "./task-workflow-support";
import { TenantAdminTaskItemDto } from "./tenant-admin-tasks.dto";
import { requireEmployeeManagerContext } from "./employee-context";
import {
  EmployeeManagerClientsResponseDto,
  EmployeeManagerCreateTaskRequest,
  EmployeeManagerReviewRequest,
  EmployeeManagerReviewsResponseDto,
  EmployeeManagerTaskOptionsResponseDto,
} from "./employee-manager.dto";

@Injectable()
export class EmployeeManagerService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool | null,
    @Inject(TenantAdminTasksRepository) private readonly tasksRepository: TenantAdminTasksRepository,
  ) {}

  getOptions(context: RequestContext): Promise<EmployeeManagerTaskOptionsResponseDto> {
    return this.tasksRepository.getOptions(requireEmployeeManagerContext(context));
  }

  async createTask(context: RequestContext, input: EmployeeManagerCreateTaskRequest): Promise<TenantAdminTaskItemDto> {
    const task = await this.tasksRepository.createTask(requireEmployeeManagerContext(context), input);
    return { ...task, plannedDueAt: task.plannedDueAt ? task.plannedDueAt.toISOString() : null };
  }

  async listClients(context: RequestContext): Promise<EmployeeManagerClientsResponseDto> {
    const managerContext = requireEmployeeManagerContext(context);
    return this.withContext(managerContext, async (client) => {
      const result = await client.query<{ id: string; name: string; status: string; open_tasks: string }>(
        `
          select c.id::text, c.display_name as name, c.status, count(t.id)::text as open_tasks
          from public.clients c
          left join public.tasks t
            on t.tenant_id = c.tenant_id
           and t.client_id = c.id
           and t.status in ('assigned', 'in_progress', 'manager_review', 'returned', 'tenant_approval')
          where c.tenant_id = $1
            and c.status in ('active', 'onboarding')
          group by c.id, c.display_name, c.status
          order by c.display_name asc
        `,
        [managerContext.tenantId],
      );
      return { clients: result.rows.map((row) => ({ id: row.id, name: row.name, status: row.status, openTasks: Number(row.open_tasks) })) };
    });
  }

  async listReviews(context: RequestContext): Promise<EmployeeManagerReviewsResponseDto> {
    const managerContext = requireEmployeeManagerContext(context);
    return this.withContext(managerContext, async (client) => {
      const result = await client.query<{
        id: string;
        title: string;
        client_name: string;
        employee_name: string;
        submitted_at: Date;
        worked_seconds: string;
        task_comment: string | null;
      }>(
        `
          with latest_submissions as (
            select distinct on (tenant_id, task_id)
              tenant_id, task_id, employee_id, submitted_at, task_comment
            from public.task_submissions
            where tenant_id = $1 and status = 'submitted'
            order by tenant_id, task_id, submitted_at desc
          ),
          worked as (
            select tenant_id, task_id, employee_id,
                   coalesce(sum(extract(epoch from (coalesce(ended_at, clock_timestamp()) - started_at))), 0)::bigint::text as worked_seconds
            from public.task_work_segments
            where tenant_id = $1
            group by tenant_id, task_id, employee_id
          )
          select
            t.id::text,
            t.title,
            c.display_name as client_name,
            coalesce(tm.display_name, e.employee_code) as employee_name,
            ls.submitted_at,
            coalesce(w.worked_seconds, '0') as worked_seconds,
            ls.task_comment
          from public.tasks t
          join latest_submissions ls on ls.tenant_id = t.tenant_id and ls.task_id = t.id
          join public.clients c on c.tenant_id = t.tenant_id and c.id = t.client_id
          join public.employees e on e.tenant_id = ls.tenant_id and e.id = ls.employee_id
          join public.tenant_memberships tm on tm.tenant_id = e.tenant_id and tm.id = e.membership_id
          left join worked w on w.tenant_id = ls.tenant_id and w.task_id = ls.task_id and w.employee_id = ls.employee_id
          where t.tenant_id = $1 and t.status = 'manager_review'
            and (
              exists (
                select 1
                from public.work_group_memberships wgm
                join public.employees manager_employee
                  on manager_employee.tenant_id = wgm.tenant_id
                 and manager_employee.id = wgm.employee_id
                 and manager_employee.membership_id = $2
                where wgm.tenant_id = t.tenant_id
                  and wgm.work_group_id = t.work_group_id
                  and wgm.group_role = 'manager'
                  and wgm.status = 'active'
              )
              or exists (
                select 1
                from public.employee_manager_assignments ema
                join public.employees manager_employee
                  on manager_employee.tenant_id = ema.tenant_id
                 and manager_employee.id = ema.manager_employee_id
                 and manager_employee.membership_id = $2
                where ema.tenant_id = t.tenant_id
                  and ema.employee_id = ls.employee_id
              )
            )
          order by ls.submitted_at desc
        `,
        [managerContext.tenantId, managerContext.membershipId],
      );
      return {
        tasks: result.rows.map((row) => ({
          id: row.id,
          title: row.title,
          clientName: row.client_name,
          employeeName: row.employee_name,
          submittedAt: row.submitted_at.toISOString(),
          workedSeconds: Number(row.worked_seconds),
          taskComment: row.task_comment,
        })),
      };
    });
  }

  async decideReview(context: RequestContext, taskId: string, input: EmployeeManagerReviewRequest): Promise<{ ok: true }> {
    const managerContext = requireEmployeeManagerContext(context);
    return this.withContext(managerContext, async (client) => {
      const submission = await client.query<{ id: string; employee_id: string }>(
        `
          select ts.id::text, ts.employee_id::text
          from public.task_submissions ts
          join public.tasks t on t.tenant_id = ts.tenant_id and t.id = ts.task_id
          where ts.tenant_id = $1 and ts.task_id = $2 and ts.status = 'submitted' and t.status = 'manager_review'
            and (
              exists (
                select 1
                from public.work_group_memberships wgm
                join public.employees manager_employee
                  on manager_employee.tenant_id = wgm.tenant_id
                 and manager_employee.id = wgm.employee_id
                 and manager_employee.membership_id = $3
                where wgm.tenant_id = t.tenant_id
                  and wgm.work_group_id = t.work_group_id
                  and wgm.group_role = 'manager'
                  and wgm.status = 'active'
              )
              or exists (
                select 1
                from public.employee_manager_assignments ema
                join public.employees manager_employee
                  on manager_employee.tenant_id = ema.tenant_id
                 and manager_employee.id = ema.manager_employee_id
                 and manager_employee.membership_id = $3
                where ema.tenant_id = t.tenant_id
                  and ema.employee_id = ts.employee_id
              )
            )
          order by ts.submitted_at desc
          limit 1
          for update of ts, t
        `,
        [managerContext.tenantId, taskId, managerContext.membershipId],
      );
      const row = submission.rows[0];
      if (!row) throw new ConflictException({ code: "TASK_NOT_AWAITING_MANAGER_REVIEW", message: "This task is not awaiting manager review." });

      const approved = input.decision === "approve";
      await client.query("update public.task_submissions set status = $3, updated_at = now() where tenant_id = $1 and id = $2", [
        managerContext.tenantId,
        row.id,
        approved ? "manager_approved" : "returned",
      ]);
      await client.query("update public.tasks set status = $3, billable_status = $4, actual_completed_at = case when $3 = 'completed' then coalesce(actual_completed_at, clock_timestamp()) else actual_completed_at end, updated_by = $5, updated_at = now() where tenant_id = $1 and id = $2", [
        managerContext.tenantId,
        taskId,
        approved ? "completed" : "in_progress",
        approved ? "ready_for_billing" : "pending_completion",
        managerContext.membershipId,
      ]);
      await client.query(
        "update public.task_assignments set status = $4, updated_at = now() where tenant_id = $1 and task_id = $2 and employee_id = $3",
        [managerContext.tenantId, taskId, row.employee_id, approved ? "completed" : "active"],
      );
      const billableEntry = await client.query<{ id: string }>(
        `
          update public.billable_task_entries
          set status = $3,
              approved_by = case when $3 = 'approved_for_invoice' then $4 else null end,
              approved_at = case when $3 = 'approved_for_invoice' then clock_timestamp() else null end,
              updated_at = now()
          where tenant_id = $1
            and task_id = $2
            and status = 'pending_review'
          returning id::text
        `,
        [managerContext.tenantId, taskId, approved ? "approved_for_invoice" : "pending_review", managerContext.membershipId],
      );
      if (approved && !billableEntry.rows[0]) {
        throw new ConflictException({
          code: "TASK_BILLING_ENTRY_NOT_AVAILABLE",
          message: "The task charge is not available for invoicing.",
        });
      }
      await client.query(
        `
          insert into public.approvals (tenant_id, task_id, submission_id, approval_stage, decision, remarks, decided_by)
          values ($1, $2, $3, 'manager_final_review', $4, nullif($5, ''), $6)
        `,
        [managerContext.tenantId, taskId, row.id, approved ? "approved" : "returned", input.remarks, managerContext.membershipId],
      );
      await client.query(
        "select audit.write_audit_event($1, 'task', $2::uuid, 'succeeded', null, $3::jsonb)",
        [approved ? "MANAGER_APPROVED" : "MANAGER_RETURNED", taskId, JSON.stringify({ remarks: input.remarks || null, employeeId: row.employee_id })],
      );
      const taskTitle = (await client.query<{ title: string }>(
        "select title from public.tasks where tenant_id = $1 and id = $2",
        [managerContext.tenantId, taskId],
      )).rows[0]?.title ?? "Task";
      if (approved) {
        await publishTaskWorkflowNotification(client, {
          tenantId: managerContext.tenantId,
          actorUserId: managerContext.userId,
          taskId,
          employeeId: row.employee_id,
          audience: "tenant_admins",
          type: "INVOICE_READY_TO_GENERATE",
          title: `Invoice ready: ${taskTitle}`,
          message: `Manager completed "${taskTitle}". Generate its invoice and send it to the client.`,
          actionUrl: "/admin/invoices",
          eventKey: `invoice-ready:${taskId}`,
        });
        await publishTaskWorkflowNotification(client, {
          tenantId: managerContext.tenantId,
          actorUserId: managerContext.userId,
          taskId,
          employeeId: row.employee_id,
          audience: "employee",
          type: "TASK_COMPLETED",
          title: "Task approved",
          message: `"${taskTitle}" is complete.`,
          actionUrl: `/employee/tasks?task=${taskId}`,
          eventKey: `task-completed:${taskId}`,
        });
      } else {
        const timerStarted = await resumeReturnedTaskTimer(client, managerContext.tenantId, taskId, row.employee_id);
        if (timerStarted) {
          await client.query(
            "select audit.write_audit_event('TASK_AUTO_RESUMED_AFTER_MANAGER_RETURN', 'task', $1::uuid, 'succeeded', null, $2::jsonb)",
            [taskId, JSON.stringify({ employeeId: row.employee_id })],
          );
        }
        await publishTaskWorkflowNotification(client, {
          tenantId: managerContext.tenantId,
          actorUserId: managerContext.userId,
          taskId,
          employeeId: row.employee_id,
          audience: "employee",
          type: "TASK_RETURNED_BY_MANAGER",
          title: "Task returned for changes",
          message: `"${taskTitle}" was returned: ${input.remarks}. ${timerStarted ? "Your timer has resumed." : "Resume it when your current task is complete."}`,
          actionUrl: `/employee/tasks?task=${taskId}`,
          eventKey: `task-returned-by-manager:${row.id}`,
        });
        await publishTaskWorkflowNotification(client, {
          tenantId: managerContext.tenantId,
          actorUserId: managerContext.userId,
          taskId,
          employeeId: row.employee_id,
          audience: "tenant_admins",
          type: "TASK_REVIEW_CLOSED_BY_MANAGER",
          title: "Task returned by manager",
          message: `Manager returned "${taskTitle}" for changes. This task is no longer awaiting review.`,
          actionUrl: `/admin/tasks?task=${taskId}`,
          eventKey: `tenant-review-returned-by-manager:${row.id}`,
        });
      }
      await publishTaskWorkflowNotification(client, {
        tenantId: managerContext.tenantId,
        actorUserId: managerContext.userId,
        taskId,
        employeeId: row.employee_id,
        audience: "actor",
        type: approved ? "MANAGER_TASK_APPROVED" : "MANAGER_TASK_CHANGES_REQUESTED",
        title: approved ? "Task approved" : "Changes requested",
        message: approved
          ? `You completed "${taskTitle}". Its invoice is ready for the Tenant Admin.`
          : `You returned "${taskTitle}" to the employee: ${input.remarks}`,
        actionUrl: "/employee/task-reviews",
        eventKey: `manager-decision:${row.id}:${input.decision}`,
      });
      return { ok: true };
    });
  }

  private async withContext<T>(context: ReturnType<typeof requireEmployeeManagerContext>, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      await setTrustedDatabaseContext(client, context);
      return work(client);
    });
  }
}
