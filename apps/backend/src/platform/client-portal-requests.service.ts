import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import {
  ClientPortalRequestCreatedDto,
  ClientPortalRequestOptionsResponseDto,
  CreateClientPortalRequest,
} from "./client-portal-requests.dto";
import { ClientPortalRequestsRepository } from "./client-portal-requests.repository";

@Injectable()
export class ClientPortalRequestsService {
  constructor(
    @Inject(ClientPortalRequestsRepository)
    private readonly repository: ClientPortalRequestsRepository,
  ) {}

  async options(context: RequestContext): Promise<ClientPortalRequestOptionsResponseDto> {
    const scoped = requireClientPortalContext(context);
    return {
      services: await this.repository.listServiceOptions(scoped),
    };
  }

  async create(context: RequestContext, input: CreateClientPortalRequest): Promise<ClientPortalRequestCreatedDto> {
    return mapRequest(await this.repository.create(requireClientPortalContext(context), input));
  }
}

function mapRequest(row: Awaited<ReturnType<ClientPortalRequestsRepository["create"]>>): ClientPortalRequestCreatedDto {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    serviceName: row.service_name,
    countryCode: row.country_code,
    requestedDueDate: row.requested_due_date,
    submittedAt: row.submitted_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
