import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import {
  ClientServiceCommentDto,
  CreateClientServiceComment,
} from "./client-portal-service-comments.dto";
import { ClientPortalServiceCommentsRepository } from "./client-portal-service-comments.repository";

@Injectable()
export class ClientPortalServiceCommentsService {
  constructor(
    @Inject(ClientPortalServiceCommentsRepository)
    private readonly repository: ClientPortalServiceCommentsRepository,
  ) {}

  create(
    context: RequestContext,
    serviceId: string,
    input: CreateClientServiceComment,
  ): Promise<ClientServiceCommentDto> {
    return this.repository.create(requireClientPortalContext(context), serviceId, input);
  }
}
