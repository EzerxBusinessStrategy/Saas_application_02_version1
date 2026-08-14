import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { ClientPortalRequestContext } from "./client-portal-context";
import { DecideClientPortalDeliverableRequest } from "./client-portal-deliverables.dto";
import type { StoredDocumentObject } from "./tenant-document-storage.service";

type ClientPortalDeliverableRow = {
  readonly id: string;
  readonly title: string;
  readonly file_name: string;
  readonly file_type: string;
  readonly size_bytes: number;
  readonly category: string;
  readonly uploaded_by: string;
  readonly updated_on: string;
  readonly client_decision_status: "pending" | "approved" | "rejected";
  readonly client_decision_at: string | null;
  readonly client_decision_comment: string | null;
};

@Injectable()
export class ClientPortalDeliverablesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(context: ClientPortalRequestContext): Promise<readonly ClientPortalDeliverableRow[]> {
    return this.withContext(context, (client) => this.getDeliverables(client, context));
  }

  async getDocumentStorageObject(context: ClientPortalRequestContext, documentId: string): Promise<StoredDocumentObject> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ storage_bucket: string | null; storage_key: string | null }>(
        `
          select storage_bucket, storage_key
          from public.tenant_documents
          where tenant_id = $1 and client_id = $2 and id = $3 and status = 'active'
            and coalesce(metadata->>'clientVisible', 'false') = 'true'
        `,
        [context.tenantId, context.clientAccountId, documentId],
      );
      const object = result.rows[0];
      if (!object?.storage_bucket || !object.storage_key) throw new ConflictException({ code: "DELIVERABLE_FILE_NOT_AVAILABLE", message: "The file for this deliverable is not available." });
      return { storageBucket: object.storage_bucket, storageKey: object.storage_key };
    });
  }

  async decide(
    context: ClientPortalRequestContext,
    documentId: string,
    input: DecideClientPortalDeliverableRequest,
  ): Promise<ClientPortalDeliverableRow> {
    return this.withContext(context, async (client) => {
      const result = await client.query<{ id: string; title: string }>(
        `
          update public.tenant_documents d
          set metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
              'clientDecisionStatus', $4,
              'clientDecisionAt', now(),
              'clientDecisionBy', $5,
              'clientDecisionComment', nullif($6, '')
            ),
              updated_at = now()
          where d.tenant_id = $1
            and d.client_id = $2
            and d.id = $3
            and d.status = 'active'
          returning d.id::text, d.title
        `,
        [
          context.tenantId,
          context.clientAccountId,
          documentId,
          input.decision,
          context.userId,
          input.comment ?? "",
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new ConflictException({
          code: "DELIVERABLE_NOT_AVAILABLE",
          message: "This deliverable is no longer available.",
        });
      }

      await client.query(
        "select audit.write_audit_event($1, 'document', $2::uuid, 'succeeded', null, $3::jsonb)",
        [
          input.decision === "approved" ? "CLIENT_DELIVERABLE_APPROVED" : "CLIENT_DELIVERABLE_REJECTED",
          documentId,
          JSON.stringify({ clientId: context.clientAccountId, comment: input.comment?.trim() || null }),
        ],
      );
      await this.notifyTenantDecision(client, context, documentId, row.title, input);
      return this.getDeliverableOrThrow(client, context, documentId);
    });
  }

  private async getDeliverables(
    client: PoolClient,
    context: ClientPortalRequestContext,
  ): Promise<readonly ClientPortalDeliverableRow[]> {
    const result = await client.query<ClientPortalDeliverableRow>(
      `
        select
          d.id::text,
          d.title,
          d.file_name,
          d.file_type,
          d.size_bytes,
          d.category,
          coalesce(tm.display_name, 'Tenant Administration') as uploaded_by,
          d.updated_at::text as updated_on,
          coalesce(d.metadata->>'clientDecisionStatus', 'pending') as client_decision_status,
          d.metadata->>'clientDecisionAt' as client_decision_at,
          d.metadata->>'clientDecisionComment' as client_decision_comment
        from public.tenant_documents d
        left join public.tenant_memberships tm
          on tm.id = d.created_by
         and tm.tenant_id = d.tenant_id
        where d.tenant_id = $1
          and d.client_id = $2
          and d.status = 'active'
          and coalesce(d.metadata->>'clientVisible', 'false') = 'true'
        order by d.updated_at desc, d.id desc
      `,
      [context.tenantId, context.clientAccountId],
    );
    return result.rows;
  }

  private async getDeliverableOrThrow(
    client: PoolClient,
    context: ClientPortalRequestContext,
    documentId: string,
  ): Promise<ClientPortalDeliverableRow> {
    const row = (await this.getDeliverables(client, context)).find((item) => item.id === documentId);
    if (!row) {
      throw new ConflictException({
        code: "DELIVERABLE_NOT_AVAILABLE",
        message: "This deliverable is no longer available.",
      });
    }
    return row;
  }

  private async notifyTenantDecision(
    client: PoolClient,
    context: ClientPortalRequestContext,
    documentId: string,
    title: string,
    input: DecideClientPortalDeliverableRequest,
  ): Promise<void> {
    const notificationType =
      input.decision === "approved" ? "CLIENT_DELIVERABLE_APPROVED" : "CLIENT_DELIVERABLE_REJECTED";
    const severity = input.decision === "approved" ? "SUCCESS" : "WARNING";
    const eventKey = `${notificationType.toLowerCase()}:${documentId}:${Date.now()}`;

    await client.query(
      `
        with doc_client as (
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
            $3,
            case when $3 = 'CLIENT_DELIVERABLE_APPROVED' then 'Deliverable approved' else 'Deliverable rejected' end,
            case
              when $3 = 'CLIENT_DELIVERABLE_APPROVED'
                then coalesce(doc_client.display_name, 'Client') || ' approved deliverable "' || $4 || '".'
              else coalesce(doc_client.display_name, 'Client') || ' rejected deliverable "' || $4 || '".'
            end,
            $5,
            $1,
            $6,
            'document',
            $7::uuid,
            '/admin/documents',
            jsonb_build_object(
              'clientId', $2,
              'documentId', $7::uuid,
              'title', $4,
              'comment', nullif($8, '')
            ),
            $9
          from doc_client
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
      [
        context.tenantId,
        context.clientAccountId,
        notificationType,
        title,
        severity,
        context.userId,
        documentId,
        input.comment ?? "",
        eventKey,
      ],
    );
  }

  private async withContext<T>(
    context: ClientPortalRequestContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, (_tx, client) => work(client));
  }
}
