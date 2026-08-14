import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import {
  ClientPortalDeliverableDto,
  ClientPortalDeliverablesResponseDto,
  DecideClientPortalDeliverableRequest,
} from "./client-portal-deliverables.dto";
import { ClientPortalDeliverablesRepository } from "./client-portal-deliverables.repository";
import { TenantDocumentStorageService } from "./tenant-document-storage.service";

@Injectable()
export class ClientPortalDeliverablesService {
  constructor(
    @Inject(ClientPortalDeliverablesRepository)
    private readonly repository: ClientPortalDeliverablesRepository,
    @Inject(TenantDocumentStorageService) private readonly storage: TenantDocumentStorageService,
  ) {}

  async list(context: RequestContext): Promise<ClientPortalDeliverablesResponseDto> {
    const scoped = requireClientPortalContext(context);
    return { deliverables: (await this.repository.list(scoped)).map(mapDeliverable) };
  }

  async decide(
    context: RequestContext,
    documentId: string,
    input: DecideClientPortalDeliverableRequest,
  ): Promise<ClientPortalDeliverableDto> {
    const scoped = requireClientPortalContext(context);
    return mapDeliverable(await this.repository.decide(scoped, documentId, input));
  }

  async createDownloadUrl(context: RequestContext, documentId: string): Promise<{ url: string }> {
    const scoped = requireClientPortalContext(context);
    return { url: await this.storage.createSignedDownloadUrl(await this.repository.getDocumentStorageObject(scoped, documentId)) };
  }
}

function mapDeliverable(row: Awaited<ReturnType<ClientPortalDeliverablesRepository["list"]>>[number]): ClientPortalDeliverableDto {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    fileType: row.file_type,
    sizeBytes: Number(row.size_bytes),
    category: row.category,
    uploadedBy: row.uploaded_by,
    updatedOn: row.updated_on,
    clientDecisionStatus: row.client_decision_status,
    clientDecisionAt: row.client_decision_at,
    clientDecisionComment: row.client_decision_comment,
  };
}
