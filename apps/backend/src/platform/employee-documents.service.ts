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

@Injectable()
export class EmployeeDocumentsService {
  constructor(@Inject(EmployeeDocumentsRepository) private readonly repository: EmployeeDocumentsRepository) {}

  async options(context: RequestContext): Promise<EmployeeDocumentOptionsDto> {
    return this.repository.options(requireEmployeeContext(context));
  }

  async list(context: RequestContext): Promise<EmployeeDocumentsResponseDto> {
    return { documents: (await this.repository.list(requireEmployeeContext(context))).map(mapDocument) };
  }

  async create(context: RequestContext, input: CreateEmployeeDocumentRequest): Promise<EmployeeDocumentDto> {
    return mapDocument(await this.repository.create(requireEmployeeContext(context), input));
  }
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
