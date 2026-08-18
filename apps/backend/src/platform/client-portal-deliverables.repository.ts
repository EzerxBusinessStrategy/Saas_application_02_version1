import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { databaseNotConfigured } from "../auth/auth-errors";
import { DATABASE_POOL } from "../database/database.tokens";
import { withDatabaseTransaction } from "../database/transaction-context";
import { AGREEMENT_EXPIRED_MESSAGE } from "./agreement-expiry";
import { ClientPortalRequestContext, ClientPortalScope, resolveClientPortalScope } from "./client-portal-context";
import { DecideClientPortalDeliverableRequest } from "./client-portal-deliverables.dto";
import type { StoredDocumentObject } from "./tenant-document-storage.service";

export type ClientDownloadableDocument =
  | { readonly kind: "stored"; readonly object: StoredDocumentObject }
  | {
      readonly kind: "generated-invoice";
      readonly documentId: string;
      readonly clientId: string;
      readonly invoiceId: string;
      readonly invoiceNumber: string;
      readonly clientName: string;
      readonly taskTitle: string | null;
      readonly issuedOn: string;
      readonly dueOn: string | null;
      readonly currency: string;
      readonly amount: number;
    };

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
  readonly valid_until: string | null;
  readonly access_status: "active" | "expired";
};

@Injectable()
export class ClientPortalDeliverablesRepository {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool | null) {}

  async list(context: ClientPortalRequestContext): Promise<readonly ClientPortalDeliverableRow[]> {
    return this.withContext(context, (client, scope) => this.getDeliverables(client, scope));
  }

  async getDownloadableDocument(context: ClientPortalRequestContext, documentId: string): Promise<ClientDownloadableDocument> {
    return this.withContext(context, (client, scope) => this.getDownloadableDocumentFromScope(client, scope, documentId));
  }

  async getInvoiceDownloadableDocument(context: ClientPortalRequestContext, invoiceId: string): Promise<ClientDownloadableDocument> {
    return this.withContext(context, async (client, scope) => {
      const result = await client.query<{ document_id: string }>(
        `
          select d.id::text as document_id
          from public.tenant_documents d
          where d.tenant_id = $1
            and d.client_id = $2
            and d.category = 'invoice'
            and d.status = 'active'
            and coalesce(d.metadata->>'clientVisible', 'false') = 'true'
            and d.metadata->>'invoiceId' = $3
          order by d.updated_at desc, d.id desc
          limit 1
        `,
        [scope.tenantId, scope.clientId, invoiceId],
      );
      const documentId = result.rows[0]?.document_id;
      if (!documentId) {
        throw new ConflictException({ code: "INVOICE_FILE_NOT_AVAILABLE", message: "The invoice file is not available." });
      }
      return this.getDownloadableDocumentFromScope(client, scope, documentId);
    });
  }

  private async getDownloadableDocumentFromScope(
    client: PoolClient,
    scope: ClientPortalScope,
    documentId: string,
  ): Promise<ClientDownloadableDocument> {
      const result = await client.query<{
        id: string;
        client_id: string;
        category: string;
        storage_bucket: string | null;
        storage_key: string | null;
        invoice_id: string | null;
        invoice_number: string | null;
        client_name: string | null;
        task_title: string | null;
        issued_on: string | null;
        due_on: string | null;
        currency: string | null;
        amount: number | null;
        valid_until: string | null;
      }>(
        `
          select
            d.id::text,
            d.client_id::text,
            d.category,
            d.storage_bucket,
            d.storage_key,
            i.id::text as invoice_id,
            i.invoice_number,
            c.display_name as client_name,
            (
              select t.title
              from public.invoice_items ii
              left join public.tasks t
                on t.tenant_id = ii.tenant_id
               and t.id = ii.task_id
              where ii.tenant_id = i.tenant_id
                and ii.invoice_id = i.id
              order by ii.created_at asc
              limit 1
            ) as task_title,
            i.issued_on::text,
            i.due_on::text,
            i.currency_code as currency,
            i.total_amount as amount,
            nullif(d.metadata->>'validUntil', '') as valid_until
          from public.tenant_documents d
          join public.clients c
            on c.tenant_id = d.tenant_id
           and c.id = d.client_id
          left join public.invoices i
            on i.tenant_id = d.tenant_id
           and i.id = case
             when coalesce(d.metadata->>'invoiceId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
               then (d.metadata->>'invoiceId')::uuid
             else null
           end
          where d.tenant_id = $1
            and d.client_id = $2
            and d.id = $3
            and d.status = 'active'
            and coalesce(d.metadata->>'clientVisible', 'false') = 'true'
        `,
        [scope.tenantId, scope.clientId, documentId],
      );
      const document = result.rows[0];
      if (!document) {
        throw new ConflictException({
          code: "DELIVERABLE_FILE_NOT_AVAILABLE",
          message: "The file for this deliverable is not available.",
        });
      }
      if (
        document.category === "agreement" &&
        document.valid_until &&
        new Date(document.valid_until).getTime() <= Date.now()
      ) {
        throw new ConflictException({
          code: "AGREEMENT_EXPIRED",
          message: AGREEMENT_EXPIRED_MESSAGE,
        });
      }
      if (document?.storage_bucket && document.storage_key) {
        return { kind: "stored", object: { storageBucket: document.storage_bucket, storageKey: document.storage_key } };
      }
      if (
        document?.category === "invoice" &&
        document.invoice_id &&
        document.invoice_number &&
        document.client_name &&
        document.issued_on &&
        document.currency &&
        document.amount !== null
      ) {
        return {
          kind: "generated-invoice",
          documentId: document.id,
          clientId: document.client_id,
          invoiceId: document.invoice_id,
          invoiceNumber: document.invoice_number,
          clientName: document.client_name,
          taskTitle: document.task_title,
          issuedOn: document.issued_on,
          dueOn: document.due_on,
          currency: document.currency,
          amount: Number(document.amount),
        };
      }
      throw new ConflictException({ code: "DELIVERABLE_FILE_NOT_AVAILABLE", message: "The file for this deliverable is not available." });
  }

  async attachGeneratedInvoiceStorageObject(
    context: ClientPortalRequestContext,
    documentId: string,
    object: StoredDocumentObject,
    sizeBytes: number,
  ): Promise<void> {
    await this.withContext(context, async (client, scope) => {
      await client.query(
        `
          update public.tenant_documents
          set storage_bucket = $4,
              storage_key = $5,
              content_type = 'application/pdf',
              size_bytes = $6,
              updated_at = now()
          where tenant_id = $1
            and client_id = $2
            and id = $3
            and category = 'invoice'
            and status = 'active'
            and coalesce(metadata->>'clientVisible', 'false') = 'true'
        `,
        [scope.tenantId, scope.clientId, documentId, object.storageBucket, object.storageKey, sizeBytes],
      );
    });
  }

  async decide(
    context: ClientPortalRequestContext,
    documentId: string,
    input: DecideClientPortalDeliverableRequest,
  ): Promise<ClientPortalDeliverableRow> {
    return this.withContext(context, async (client, scope) => {
      const current = (await this.getDeliverables(client, scope)).find((item) => item.id === documentId);
      if (!current) {
        throw new ConflictException({
          code: "DELIVERABLE_NOT_AVAILABLE",
          message: "This deliverable is no longer available.",
        });
      }
      if (current.access_status === "expired") {
        throw new ConflictException({
          code: "AGREEMENT_EXPIRED",
          message: AGREEMENT_EXPIRED_MESSAGE,
        });
      }

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
            and d.category <> 'invoice'
            and d.status = 'active'
          returning d.id::text, d.title
        `,
        [
          scope.tenantId,
          scope.clientId,
          documentId,
          input.decision,
          scope.userId,
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
          JSON.stringify({ clientId: scope.clientId, comment: input.comment?.trim() || null }),
        ],
      );
      await this.notifyTenantDecision(client, scope, documentId, row.title, input);
      return this.getDeliverableOrThrow(client, scope, documentId);
    });
  }

  private async getDeliverables(
    client: PoolClient,
    context: ClientPortalScope,
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
          d.metadata->>'clientDecisionComment' as client_decision_comment,
          nullif(d.metadata->>'validUntil', '') as valid_until,
          case
            when d.category = 'agreement'
              and nullif(d.metadata->>'validUntil', '') is not null
              and (d.metadata->>'validUntil')::timestamptz <= now()
            then 'expired'
            else 'active'
          end as access_status
        from public.tenant_documents d
        left join public.tenant_memberships tm
          on tm.id = d.created_by
         and tm.tenant_id = d.tenant_id
        where d.tenant_id = $1
          and d.client_id = $2
          and d.category <> 'invoice'
          and d.status = 'active'
          and coalesce(d.metadata->>'clientVisible', 'false') = 'true'
        order by d.updated_at desc, d.id desc
      `,
      [context.tenantId, context.clientId],
    );
    return result.rows;
  }

  private async getDeliverableOrThrow(
    client: PoolClient,
    context: ClientPortalScope,
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
    context: ClientPortalScope,
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
         and r.code = 'TENANT_ADMIN'
        on conflict (notification_id, recipient_user_id) do nothing
      `,
      [
        context.tenantId,
        context.clientId,
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
    work: (client: PoolClient, scope: ClientPortalScope) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) throw databaseNotConfigured();
    return withDatabaseTransaction(this.pool, context, async (_tx, client) => {
      const scope = await resolveClientPortalScope(client, context);
      return work(client, scope);
    });
  }
}
