import { Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { permissionDenied, databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import {
  ClientPortalRequestContext,
  ClientPortalScope,
  resolveClientPortalScope,
} from "./client-portal-context";
import {
  ClientServiceCommentDto,
  CreateClientServiceComment,
} from "./client-portal-service-comments.dto";

@Injectable()
export class ClientPortalServiceCommentsRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async create(
    context: ClientPortalRequestContext,
    serviceId: string,
    input: CreateClientServiceComment,
  ): Promise<ClientServiceCommentDto> {
    return this.withContext(context, async (client, scope) => {
      const existing = await this.loadByIdempotency(client, scope, input.idempotencyKey);
      if (existing) {
        return { ...existing, replayed: true };
      }

      const service = await this.requireClientService(client, scope, serviceId);
      const inserted = await client.query<{ id: string; created_at: Date }>(
        `
          insert into public.client_service_comments (
            tenant_id, client_id, service_id, body, created_by_user_id, idempotency_key
          )
          values ($1, $2, $3, $4, $5, $6)
          on conflict (tenant_id, idempotency_key) do nothing
          returning id::text, created_at
        `,
        [scope.tenantId, scope.clientId, serviceId, input.body, scope.userId, input.idempotencyKey],
      );
      const row = inserted.rows[0];
      if (!row) {
        const replayed = await this.loadByIdempotency(client, scope, input.idempotencyKey);
        if (replayed) return { ...replayed, replayed: true };
        throw permissionDenied();
      }

      await this.notifyTenant(client, scope, row.id, serviceId, service.name, input.body);
      await client.query(
        "select audit.write_audit_event('CLIENT_SERVICE_COMMENT_CREATED', 'client_service_comment', $1::uuid, 'succeeded', null, $2::jsonb)",
        [row.id, JSON.stringify({ clientId: scope.clientId, serviceId, serviceName: service.name })],
      );
      return {
        id: row.id,
        serviceId,
        serviceName: service.name,
        body: input.body,
        replayed: false,
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  private async requireClientService(
    client: PoolClient,
    scope: ClientPortalScope,
    serviceId: string,
  ): Promise<{ name: string }> {
    const result = await client.query<{ name: string }>(
      `
        select s.name
        from public.services s
        where s.tenant_id = $1
          and s.id = $2
          and (
            exists (
              select 1
              from public.engagements e
              where e.tenant_id = s.tenant_id
                and e.client_id = $3
                and e.service_id = s.id
                and e.status in ('draft', 'active')
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
      [scope.tenantId, serviceId, scope.clientId],
    );
    const name = result.rows[0]?.name;
    if (!name) throw permissionDenied();
    return { name };
  }

  private async loadByIdempotency(
    client: PoolClient,
    scope: ClientPortalScope,
    idempotencyKey: string,
  ): Promise<Omit<ClientServiceCommentDto, "replayed"> | null> {
    const result = await client.query<{
      id: string;
      service_id: string;
      service_name: string;
      body: string;
      created_at: Date;
    }>(
      `
        select
          csc.id::text,
          csc.service_id::text,
          s.name as service_name,
          csc.body,
          csc.created_at
        from public.client_service_comments csc
        join public.services s
          on s.tenant_id = csc.tenant_id
         and s.id = csc.service_id
        where csc.tenant_id = $1
          and csc.client_id = $2
          and csc.idempotency_key = $3
      `,
      [scope.tenantId, scope.clientId, idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      body: row.body,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async notifyTenant(
    client: PoolClient,
    context: ClientPortalScope,
    commentId: string,
    serviceId: string,
    serviceName: string,
    body: string,
  ): Promise<void> {
    await client.query(
      `
        with comment_client as (
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
            'CLIENT_SERVICE_COMMENT',
            'Client comment',
            coalesce(comment_client.display_name, 'Client') || ' commented on ' || $5 || ': ' || $6,
            'INFO',
            $1,
            $7,
            'client_service_comment',
            $3::uuid,
            '/admin/tasks',
            jsonb_build_object(
              'clientId', $2,
              'commentId', $3::uuid,
              'serviceId', $4::uuid,
              'serviceName', $5,
              'body', $6
            ),
            'client-service-comment:' || $3::uuid::text
          from comment_client
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
      [context.tenantId, context.clientId, commentId, serviceId, serviceName, body, context.userId],
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
