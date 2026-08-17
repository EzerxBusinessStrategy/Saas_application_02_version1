import { ForbiddenException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ClientPortalServiceCommentsRepository } from "../../src/platform/client-portal-service-comments.repository";
import type { CreateClientServiceComment } from "../../src/platform/client-portal-service-comments.dto";

const clientContext = {
  authUserId: "auth-client",
  userId: "user-client",
  tenantId: "tenant-1",
  membershipId: "member-client",
  clientAccountId: "account-1",
  roles: ["CLIENT_USER"],
  permissions: ["client.read.assigned"],
  isPlatformAdmin: false,
  requestId: "req-client",
};

const serviceId = "22222222-2222-4222-8222-222222222222";
const clientId = "44444444-4444-4444-8444-444444444444";
const commentId = "66666666-6666-4666-8666-666666666666";
const input: CreateClientServiceComment = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  body: "Please share the GST workings this week.",
};

function createRepository(query: (sql: string, values?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>) {
  const client = {
    query: vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (
        sql.includes("begin") ||
        sql.includes("commit") ||
        sql.includes("rollback") ||
        sql.includes("set_config")
      ) {
        return { rows: [], rowCount: 0 };
      }
      return query(sql, values);
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { repository: new ClientPortalServiceCommentsRepository(pool as never), client };
}

describe("ClientPortalServiceCommentsRepository", () => {
  it("creates a comment for the authenticated client and notifies tenant admins with the client name", async () => {
    const { repository, client } = createRepository(async (sql) => {
      if (sql.includes("from public.client_portal_accounts")) {
        return { rows: [{ client_id: clientId }], rowCount: 1 };
      }
      if (sql.includes("csc.idempotency_key")) return { rows: [], rowCount: 0 };
      if (sql.includes("from public.services s") && sql.includes("s.id = $2")) {
        return { rows: [{ name: "taxation" }], rowCount: 1 };
      }
      if (sql.includes("insert into public.client_service_comments")) {
        return { rows: [{ id: commentId, created_at: new Date("2026-08-17T10:00:00.000Z") }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const created = await repository.create(clientContext, serviceId, input);

    expect(created.id).toBe(commentId);
    expect(created.replayed).toBe(false);
    expect(created.body).toBe(input.body);
    const insertValues = client.query.mock.calls.find((call) =>
      String(call[0]).includes("insert into public.client_service_comments"),
    )?.[1];
    expect(insertValues?.[1]).toBe(clientId);
    expect(insertValues?.[2]).toBe(serviceId);
    expect(insertValues?.[4]).toBe(clientContext.userId);
    const notifySql = client.query.mock.calls.find((call) =>
      String(call[0]).includes("CLIENT_SERVICE_COMMENT"),
    )?.[0];
    expect(String(notifySql)).toContain("coalesce(comment_client.display_name, 'Client')");
    expect(String(notifySql)).toContain("r.code in ('TENANT_ADMIN', 'TENANT_OWNER')");
    expect(String(notifySql)).toContain("client-service-comment:");
  });

  it("replays the same idempotency key without inserting another comment", async () => {
    const { repository, client } = createRepository(async (sql) => {
      if (sql.includes("from public.client_portal_accounts")) {
        return { rows: [{ client_id: clientId }], rowCount: 1 };
      }
      if (sql.includes("csc.idempotency_key")) {
        return {
          rows: [
            {
              id: commentId,
              service_id: serviceId,
              service_name: "taxation",
              body: input.body,
              created_at: new Date("2026-08-17T10:00:00.000Z"),
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const created = await repository.create(clientContext, serviceId, input);
    expect(created.replayed).toBe(true);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("insert into public.client_service_comments"))).toBe(
      false,
    );
  });

  it("denies comments for a service that is not this client's active work", async () => {
    const { repository } = createRepository(async (sql) => {
      if (sql.includes("from public.client_portal_accounts")) {
        return { rows: [{ client_id: clientId }], rowCount: 1 };
      }
      if (sql.includes("csc.idempotency_key")) return { rows: [], rowCount: 0 };
      if (sql.includes("from public.services s")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    await expect(repository.create(clientContext, serviceId, input)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("client portal service comments authorization", () => {
  it("requires the assigned client portal permission and does not leak inaccessible services", () => {
    const controller = readFileSync(
      resolve(__dirname, "../../src/platform/client-portal-service-comments.controller.ts"),
      "utf8",
    );
    const repository = readFileSync(
      resolve(__dirname, "../../src/platform/client-portal-service-comments.repository.ts"),
      "utf8",
    );

    expect(controller).toContain('RequirePermissions("client.read.assigned")');
    expect(controller).toContain("PortalSessionGuard");
    expect(repository).toContain("permissionDenied()");
    expect(repository).toContain("resolveClientPortalScope");
    expect(repository).toContain("scope.clientId");
    expect(repository).not.toContain("context.clientAccountId as clientId");
  });
});
