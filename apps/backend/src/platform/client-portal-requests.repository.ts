import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { ClientPortalRequestContext, ClientPortalScope, resolveClientPortalScope } from "./client-portal-context";
import { CreateClientPortalRequest } from "./client-portal-requests.dto";

type ServiceOptionRow = {
  readonly id: string;
  readonly name: string;
};

type RequestRow = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly service_name: string;
  readonly country_code: string;
  readonly requested_due_date: string | null;
  readonly submitted_at: Date;
  readonly updated_at: Date;
};

@Injectable()
export class ClientPortalRequestsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async listServiceOptions(context: ClientPortalRequestContext): Promise<readonly ServiceOptionRow[]> {
    return this.withContext(context, async (client, scope) => {
      const result = await client.query<ServiceOptionRow>(
        `
          select s.id::text, s.name
          from public.services s
          where s.tenant_id = $1
            and s.status = 'active'
            and (
              exists (
                select 1
                from public.engagements e
                where e.tenant_id = s.tenant_id
                  and e.client_id = $2
                  and e.service_id = s.id
                  and e.status = 'active'
              )
              or exists (
                select 1
                from public.tasks t
                where t.tenant_id = s.tenant_id
                  and t.client_id = $2
                  and t.service_id = s.id
                  and t.status <> 'cancelled'
              )
            )
          order by lower(s.name), s.id
        `,
        [scope.tenantId, scope.clientId],
      );
      return result.rows;
    });
  }

  async create(context: ClientPortalRequestContext, input: CreateClientPortalRequest): Promise<RequestRow> {
    return this.withContext(context, async (client, scope) => {
      const service = await client.query<ServiceOptionRow>(
        `
          select s.id::text, s.name
          from public.services s
          where s.tenant_id = $1
            and s.id = $2
            and s.status = 'active'
            and (
              exists (
                select 1
                from public.engagements e
                where e.tenant_id = s.tenant_id
                  and e.client_id = $3
                  and e.service_id = s.id
                  and e.status = 'active'
              )
              or exists (
                select 1
                from public.tasks t
                where t.tenant_id = s.tenant_id
                  and t.client_id = $3
                  and t.service_id = s.id
                  and t.status <> 'cancelled'
              )
            )
        `,
        [scope.tenantId, input.serviceId, scope.clientId],
      );
      const serviceName = service.rows[0]?.name;
      if (!serviceName) {
        throw new ConflictException({ code: "SERVICE_NOT_AVAILABLE", message: "This service is not available." });
      }

      const inserted = await client.query<{ id: string }>(
        `
          insert into public.client_task_requests (
            tenant_id,
            client_id,
            service_id,
            title,
            description,
            country_code,
            requested_due_date,
            priority,
            status,
            submitted_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted', $9)
          returning id::text
        `,
        [
          scope.tenantId,
          scope.clientId,
          input.serviceId,
          input.title,
          input.description,
          input.countryCode,
          input.requestedDueDate ?? null,
          input.priority,
          scope.userId,
        ],
      );
      const requestId = inserted.rows[0]?.id;
      if (!requestId) {
        throw new ConflictException({ code: "CLIENT_REQUEST_CREATE_FAILED", message: "Request could not be created." });
      }

      await client.query(
        "select audit.write_audit_event('CLIENT_REQUEST_RECEIVED', 'client_task_request', $1::uuid, 'succeeded', null, $2::jsonb)",
        [requestId, JSON.stringify({ clientId: scope.clientId, serviceId: input.serviceId, serviceName, title: input.title })],
      );
      await this.notifyTenant(client, scope, requestId, input.title, serviceName);
      return this.getRequestOrThrow(client, scope, requestId);
    });
  }

  private async getRequestOrThrow(client: PoolClient, context: ClientPortalScope, requestId: string): Promise<RequestRow> {
    const result = await client.query<RequestRow>(
      `
        select
          ctr.id::text,
          ctr.title,
          ctr.status,
          s.name as service_name,
          ctr.country_code,
          ctr.requested_due_date::text,
          ctr.submitted_at,
          ctr.updated_at
        from public.client_task_requests ctr
        join public.services s
          on s.id = ctr.service_id
         and s.tenant_id = ctr.tenant_id
        where ctr.tenant_id = $1
          and ctr.client_id = $2
          and ctr.id = $3
      `,
      [context.tenantId, context.clientId, requestId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new ConflictException({ code: "CLIENT_REQUEST_NOT_FOUND", message: "Request could not be loaded." });
    }
    return row;
  }

  private async notifyTenant(
    client: PoolClient,
    context: ClientPortalScope,
    requestId: string,
    title: string,
    serviceName: string,
  ): Promise<void> {
    await client.query(
      `
        with request_client as (
          select display_name
          from public.clients
          where tenant_id = $1
            and id = $2
        ),
        inserted as (
          insert into public.notifications (
            type, title, message, severity, tenant_id, actor_user_id, entity_type, entity_id, action_url, metadata, idempotency_key
          )
          select
            'CLIENT_REQUEST_RECEIVED',
            'Client service request',
            coalesce(request_client.display_name, 'Client') || ' requested "' || $4 || '" for ' || $5 || '.',
            'INFO',
            $1,
            $6,
            'client_task_request',
            $3::uuid,
            '/admin',
            jsonb_build_object('clientId', $2, 'requestId', $3::uuid, 'title', $4, 'serviceName', $5),
            'client-request-received:' || $3::uuid::text
          from request_client
          on conflict (idempotency_key) do nothing
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
         and r.code = 'TENANT_ADMIN'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [context.tenantId, context.clientId, requestId, title, serviceName, context.userId],
    );
  }

  private async withContext<T>(
    context: ClientPortalRequestContext,
    work: (client: PoolClient, scope: ClientPortalScope) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const scope = await resolveClientPortalScope(client, context);
      return work(client, scope);
    });
  }
}
