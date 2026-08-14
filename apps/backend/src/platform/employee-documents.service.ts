import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireEmployeeContext } from "./employee-context";
import {
  CreateEmployeeDocumentRequest,
  EmployeeDocumentDto,
  EmployeeDocumentOptionsDto,
  EmployeeDocumentsResponseDto,
} from "./employee-documents.dto";
import { EmployeeDocumentRow, EmployeeDocumentsRepository } from "./employee-documents.repository";
import { type DocumentStoragePortal, TenantDocumentStorageService } from "./tenant-document-storage.service";

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    @Inject(EmployeeDocumentsRepository) private readonly repository: EmployeeDocumentsRepository,
    @Inject(TenantDocumentStorageService) private readonly storage: TenantDocumentStorageService,
  ) {}

  async options(context: RequestContext): Promise<EmployeeDocumentOptionsDto> {
    return this.repository.options(requireEmployeeContext(context));
  }

  async list(context: RequestContext): Promise<EmployeeDocumentsResponseDto> {
    return { documents: (await this.repository.list(requireEmployeeContext(context))).map(mapDocument) };
  }

  async create(context: RequestContext, input: CreateEmployeeDocumentRequest): Promise<EmployeeDocumentDto> {
    const scoped = requireEmployeeContext(context);
    const portal = documentPortalFor(scoped);
    const object = await this.storage.verifyUploadedFile({ tenantId: scoped.tenantId, clientId: input.clientId, portal, storageKey: input.storageKey, fileName: input.fileName, contentType: input.contentType, sizeBytes: input.sizeBytes });
    return mapDocument(await this.repository.create(scoped, input, object.storageBucket));
  }

  async createUploadUrl(context: RequestContext, input: { clientId: string; fileName: string; contentType: string; sizeBytes: number; idempotencyKey?: string }) {
    const scoped = requireEmployeeContext(context);
    return this.storage.createSignedUploadUrl({ tenantId: scoped.tenantId, portal: documentPortalFor(scoped), ...input, operationId: input.idempotencyKey });
  }

  async createDownloadUrl(context: RequestContext, documentId: string): Promise<{ url: string }> {
    const scoped = requireEmployeeContext(context);
    return { url: await this.storage.createSignedDownloadUrl(await this.repository.getDocumentStorageObject(scoped, documentId)) };
  }
}

function documentPortalFor(context: RequestContext): DocumentStoragePortal {
  return context.roles.includes("MANAGER") ? "MANAGER" : "EMPLOYEE";
}

function mapDocument(row: EmployeeDocumentRow): EmployeeDocumentDto {
  return {
    id: row.id,
    clientId: row.client_id,
    client: row.client,
    title: row.title,
    fileName: row.file_name,
    fileType: row.file_type,
    sizeBytes: Number(row.size_bytes),
    category: row.category,
    uploadedBy: row.uploaded_by,
    uploadedById: row.uploaded_by_id,
    updatedOn: row.updated_on,
    status: row.status,
    clientDecisionStatus: row.client_decision_status,
    clientDecisionAt: row.client_decision_at,
    clientDecisionBy: row.client_decision_by,
    clientDecisionComment: row.client_decision_comment,
    shareReason: row.share_reason,
    recipientTenantAdminIds: row.recipient_tenant_admin_ids ?? [],
    recipientManagerIds: row.recipient_manager_ids ?? [],
  };
}
