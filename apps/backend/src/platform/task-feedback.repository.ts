import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { permissionDenied, databaseNotConfigured, forbiddenPortal } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import {
  ClientPortalRequestContext,
  ClientPortalScope,
  resolveClientPortalScope,
} from "./client-portal-context";
import { EmployeeRequestContext } from "./employee-context";
import { TenantAdminRequestContext } from "./tenant-admin-context";
import {
  ClientTaskFeedbackDto,
  PendingTaskFeedbackItemDto,
  SubmitClientTaskFeedback,
  TaskFeedbackLogItemDto,
} from "./task-feedback.dto";

type FeedbackRow = {
  id: string;
  task_id: string;
  task_title: string;
  invoice_id: string;
  employee_id: string;
  employee_name: string;
  client_id: string;
  client_name: string;
  task_rating: number | null;
  employee_rating: number | null;
  status: "submitted" | "expired";
  created_at: Date;
};

@Injectable()
export class TaskFeedbackRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async listPendingForClient(
    context: ClientPortalRequestContext,
  ): Promise<readonly PendingTaskFeedbackItemDto[]> {
    return this.withClientScope(context, async (client, scope) => {
      await this.expireUnanswered(client);
      const result = await client.query<{
        task_id: string;
        task_title: string;
        invoice_id: string;
        invoice_number: string;
        employee_id: string;
        employee_name: string;
        invoice_sent_at: Date;
        completed_at: Date;
        expires_at: Date;
      }>(
        `
          select distinct on (t.id)
            t.id::text as task_id,
            t.title as task_title,
            i.id::text as invoice_id,
            i.invoice_number,
            e.id::text as employee_id,
            coalesce(tm.display_name, e.employee_code) as employee_name,
            coalesce(i.finalized_at, i.updated_at) as invoice_sent_at,
            coalesce(t.actual_completed_at, t.updated_at) as completed_at,
            coalesce(t.actual_completed_at, t.updated_at) + interval '60 days' as expires_at
          from public.invoices i
          join public.invoice_items ii
            on ii.tenant_id = i.tenant_id
           and ii.invoice_id = i.id
          join public.tasks t
            on t.tenant_id = ii.tenant_id
           and t.id = ii.task_id
          join public.task_assignments ta
            on ta.tenant_id = t.tenant_id
           and ta.task_id = t.id
           and ta.status not in ('removed', 'cancelled')
          join public.employees e
            on e.tenant_id = ta.tenant_id
           and e.id = ta.employee_id
          join public.tenant_memberships tm
            on tm.tenant_id = e.tenant_id
           and tm.id = e.membership_id
          left join public.client_task_feedback ctf
            on ctf.tenant_id = t.tenant_id
           and ctf.task_id = t.id
          where i.tenant_id = $1
            and i.client_id = $2
            and i.status not in ('draft', 'cancelled', 'void')
            and i.finalized_at is not null
            and t.status = 'completed'
            and ctf.id is null
            and coalesce(t.actual_completed_at, t.updated_at) + interval '60 days' > now()
          order by t.id, ta.updated_at desc, i.finalized_at desc
        `,
        [scope.tenantId, scope.clientId],
      );

      return result.rows.map((row) => ({
        taskId: row.task_id,
        taskTitle: row.task_title,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        invoiceSentAt: row.invoice_sent_at.toISOString(),
        completedAt: row.completed_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
      }));
    });
  }

  async submitForClient(
    context: ClientPortalRequestContext,
    input: SubmitClientTaskFeedback,
  ): Promise<ClientTaskFeedbackDto> {
    return this.withClientScope(context, async (client, scope) => {
      const existing = await this.loadByIdempotency(client, scope, input.idempotencyKey);
      if (existing) {
        return { ...existing, replayed: true };
      }

      await this.expireUnanswered(client);

      const pending = await client.query<{
        task_id: string;
        task_title: string;
        invoice_id: string;
        employee_id: string;
        employee_name: string;
      }>(
        `
          select distinct on (t.id)
            t.id::text as task_id,
            t.title as task_title,
            i.id::text as invoice_id,
            e.id::text as employee_id,
            coalesce(tm.display_name, e.employee_code) as employee_name
          from public.invoices i
          join public.invoice_items ii
            on ii.tenant_id = i.tenant_id
           and ii.invoice_id = i.id
          join public.tasks t
            on t.tenant_id = ii.tenant_id
           and t.id = ii.task_id
          join public.task_assignments ta
            on ta.tenant_id = t.tenant_id
           and ta.task_id = t.id
           and ta.status not in ('removed', 'cancelled')
          join public.employees e
            on e.tenant_id = ta.tenant_id
           and e.id = ta.employee_id
          join public.tenant_memberships tm
            on tm.tenant_id = e.tenant_id
           and tm.id = e.membership_id
          left join public.client_task_feedback ctf
            on ctf.tenant_id = t.tenant_id
           and ctf.task_id = t.id
          where i.tenant_id = $1
            and i.client_id = $2
            and t.id = $3
            and i.id = $4
            and i.status not in ('draft', 'cancelled', 'void')
            and i.finalized_at is not null
            and t.status = 'completed'
            and ctf.id is null
            and coalesce(t.actual_completed_at, t.updated_at) + interval '60 days' > now()
          order by t.id, ta.updated_at desc
          limit 1
        `,
        [scope.tenantId, scope.clientId, input.taskId, input.invoiceId],
      );
      const eligible = pending.rows[0];
      if (!eligible) throw permissionDenied();

      const inserted = await client.query<{ id: string; created_at: Date }>(
        `
          insert into public.client_task_feedback (
            tenant_id, client_id, task_id, invoice_id, employee_id,
            task_rating, employee_rating, submitted_by_user_id, idempotency_key, status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')
          on conflict (tenant_id, idempotency_key) do nothing
          returning id::text, created_at
        `,
        [
          scope.tenantId,
          scope.clientId,
          eligible.task_id,
          eligible.invoice_id,
          eligible.employee_id,
          input.taskRating,
          input.employeeRating,
          scope.userId,
          input.idempotencyKey,
        ],
      );
      const row = inserted.rows[0];
      if (!row) {
        const replayed = await this.loadByIdempotency(client, scope, input.idempotencyKey);
        if (replayed) return { ...replayed, replayed: true };
        throw new ConflictException({
          code: "TASK_FEEDBACK_ALREADY_SUBMITTED",
          message: "Feedback has already been submitted for this task.",
        });
      }

      await this.notifyTenantAndEmployee(
        client,
        scope,
        row.id,
        eligible.task_title,
        eligible.employee_id,
        eligible.employee_name,
        input.taskRating,
        input.employeeRating,
      );
      await client.query(
        "select audit.write_audit_event('CLIENT_TASK_FEEDBACK_SUBMITTED', 'client_task_feedback', $1::uuid, 'succeeded', null, $2::jsonb)",
        [
          row.id,
          JSON.stringify({
            clientId: scope.clientId,
            taskId: eligible.task_id,
            employeeId: eligible.employee_id,
            taskRating: input.taskRating,
            employeeRating: input.employeeRating,
          }),
        ],
      );

      return {
        id: row.id,
        taskId: eligible.task_id,
        taskTitle: eligible.task_title,
        invoiceId: eligible.invoice_id,
        employeeId: eligible.employee_id,
        employeeName: eligible.employee_name,
        taskRating: input.taskRating,
        employeeRating: input.employeeRating,
        replayed: false,
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  async listForTenant(context: TenantAdminRequestContext): Promise<{
    items: readonly TaskFeedbackLogItemDto[];
    total: number;
  }> {
    return this.withTenantContext(context, async (client) => {
      await this.expireUnanswered(client);
      const rows = await this.queryFeedbackRows(client, context.tenantId);
      return {
        items: rows.map(mapFeedbackLogItem),
        total: rows.length,
      };
    });
  }

  async listForEmployee(context: EmployeeRequestContext): Promise<{
    items: readonly TaskFeedbackLogItemDto[];
    total: number;
  }> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      await this.expireUnanswered(client);
      const employee = await this.getEmployee(client, context);
      const rows = await this.queryFeedbackRows(client, context.tenantId, employee.id);
      return {
        items: rows.map(mapFeedbackLogItem),
        total: rows.length,
      };
    });
  }

  private async queryFeedbackRows(
    client: PoolClient,
    tenantId: string,
    employeeId?: string,
  ): Promise<readonly FeedbackRow[]> {
    const result = await client.query<FeedbackRow>(
      `
        select
          ctf.id::text,
          ctf.task_id::text,
          t.title as task_title,
          ctf.invoice_id::text,
          ctf.employee_id::text,
          coalesce(employee_tm.display_name, e.employee_code) as employee_name,
          ctf.client_id::text,
          c.display_name as client_name,
          ctf.task_rating,
          ctf.employee_rating,
          coalesce(ctf.status, 'submitted') as status,
          ctf.created_at
        from public.client_task_feedback ctf
        join public.tasks t
          on t.tenant_id = ctf.tenant_id
         and t.id = ctf.task_id
        join public.clients c
          on c.tenant_id = ctf.tenant_id
         and c.id = ctf.client_id
        join public.employees e
          on e.tenant_id = ctf.tenant_id
         and e.id = ctf.employee_id
        join public.tenant_memberships employee_tm
          on employee_tm.tenant_id = e.tenant_id
         and employee_tm.id = e.membership_id
        where ctf.tenant_id = $1
          and ($2::uuid is null or ctf.employee_id = $2)
        order by ctf.created_at desc, ctf.id desc
      `,
      [tenantId, employeeId ?? null],
    );
    return result.rows;
  }

  private async loadByIdempotency(
    client: PoolClient,
    scope: ClientPortalScope,
    idempotencyKey: string,
  ): Promise<Omit<ClientTaskFeedbackDto, "replayed"> | null> {
    const result = await client.query<{
      id: string;
      task_id: string;
      task_title: string;
      invoice_id: string;
      employee_id: string;
      employee_name: string;
      task_rating: number;
      employee_rating: number;
      created_at: Date;
    }>(
      `
        select
          ctf.id::text,
          ctf.task_id::text,
          t.title as task_title,
          ctf.invoice_id::text,
          ctf.employee_id::text,
          coalesce(tm.display_name, e.employee_code) as employee_name,
          ctf.task_rating,
          ctf.employee_rating,
          ctf.created_at
        from public.client_task_feedback ctf
        join public.tasks t
          on t.tenant_id = ctf.tenant_id
         and t.id = ctf.task_id
        join public.employees e
          on e.tenant_id = ctf.tenant_id
         and e.id = ctf.employee_id
        join public.tenant_memberships tm
          on tm.tenant_id = e.tenant_id
         and tm.id = e.membership_id
        where ctf.tenant_id = $1
          and ctf.client_id = $2
          and ctf.idempotency_key = $3
      `,
      [scope.tenantId, scope.clientId, idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      invoiceId: row.invoice_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      taskRating: row.task_rating,
      employeeRating: row.employee_rating,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async notifyTenantAndEmployee(
    client: PoolClient,
    scope: ClientPortalScope,
    feedbackId: string,
    taskTitle: string,
    employeeId: string,
    employeeName: string,
    taskRating: number,
    employeeRating: number,
  ): Promise<void> {
    await client.query(
      `
        with client_row as (
          select display_name
          from public.clients
          where tenant_id = $1
            and id = $2
        ),
        inserted as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id,
            entity_type, entity_id, action_url, metadata, idempotency_key
          )
          select
            'CLIENT_TASK_FEEDBACK',
            'Client feedback received',
            coalesce(client_row.display_name, 'Client')
              || ' rated "' || $3 || '" (' || $4::text || '/5 task, ' || $5::text || '/5 employee).',
            'INFO',
            $1,
            $6,
            'client_task_feedback',
            $7::uuid,
            '/admin/feedback-log',
            jsonb_build_object(
              'clientId', $2,
              'feedbackId', $7::uuid,
              'taskTitle', $3,
              'employeeId', $8::uuid,
              'employeeName', $9,
              'taskRating', $4,
              'employeeRating', $5
            ),
            'client-task-feedback:' || $7::uuid::text
          from client_row
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select inserted.id, tm.user_id
        from inserted
        join public.tenant_memberships tm
          on tm.tenant_id = $1
         and tm.status = 'active'
        join public.membership_roles mr
          on mr.tenant_id = tm.tenant_id
         and mr.membership_id = tm.id
         and mr.status = 'active'
        join public.roles r
          on r.id = mr.role_id
         and r.code in ('TENANT_ADMIN', 'TENANT_OWNER')
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [
        scope.tenantId,
        scope.clientId,
        taskTitle,
        taskRating,
        employeeRating,
        scope.userId,
        feedbackId,
        employeeId,
        employeeName,
      ],
    );

    await client.query(
      `
        with inserted as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id,
            entity_type, entity_id, action_url, metadata, idempotency_key
          )
          values (
            'EMPLOYEE_TASK_FEEDBACK',
            'New client feedback',
            'You received ' || $5::text || '/5 for "' || $3 || '".',
            'INFO',
            $1,
            $2,
            'client_task_feedback',
            $4::uuid,
            '/employee/feedback',
            jsonb_build_object(
              'feedbackId', $4::uuid,
              'taskTitle', $3,
              'employeeRating', $5,
              'taskRating', $6
            ),
            'employee-task-feedback:' || $4::uuid::text
          )
          on conflict (idempotency_key) where idempotency_key is not null do nothing
          returning id
        )
        insert into public.notification_recipients (notification_id, recipient_user_id)
        select inserted.id, tm.user_id
        from inserted
        join public.employees e
          on e.tenant_id = $1
         and e.id = $7
        join public.tenant_memberships tm
          on tm.tenant_id = e.tenant_id
         and tm.id = e.membership_id
         and tm.status = 'active'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [scope.tenantId, scope.userId, taskTitle, feedbackId, employeeRating, taskRating, employeeId],
    );
  }

  private async getEmployee(
    client: PoolClient,
    context: EmployeeRequestContext,
  ): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
      `
        select e.id::text
        from public.employees e
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

  private async expireUnanswered(client: PoolClient): Promise<void> {
    await client.query("select private.expire_unanswered_client_task_feedback()").catch((error: unknown) => {
      if (isUndefinedFunction(error) || isUndefinedTable(error)) return;
      throw error;
    });
  }

  private async withClientScope<T>(
    context: ClientPortalRequestContext,
    work: (client: PoolClient, scope: ClientPortalScope) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const scope = await resolveClientPortalScope(client, context);
      return work(client, scope);
    });
  }

  private async withTenantContext<T>(
    context: TenantAdminRequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => work(client));
  }
}

function mapFeedbackLogItem(row: FeedbackRow): TaskFeedbackLogItemDto {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    clientId: row.client_id,
    clientName: row.client_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    taskRating: row.task_rating,
    employeeRating: row.employee_rating,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

function isUndefinedTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

function isUndefinedFunction(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42883";
}
