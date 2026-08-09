import { Inject, Injectable } from "@nestjs/common";
import { RequestContext } from "../auth/request-context";
import { requireClientPortalContext } from "./client-portal-context";
import { ClientPortalProfileDto, UpdateClientPortalProfile } from "./client-portal-profile.dto";
import { ClientPortalProfileRepository } from "./client-portal-profile.repository";

const defaultProfile: ClientPortalProfileDto = {
  portalName: "Client portal",
  primaryColour: "#3C50E0",
  sidebarColour: "#1C2434",
  surfaceColour: "#FFFFFF",
};

@Injectable()
export class ClientPortalProfileService {
  constructor(
    @Inject(ClientPortalProfileRepository)
    private readonly repository: ClientPortalProfileRepository,
  ) {}

  async read(context: RequestContext): Promise<ClientPortalProfileDto> {
    return this.map(await this.repository.read(requireClientPortalContext(context)));
  }

  async update(context: RequestContext, input: UpdateClientPortalProfile): Promise<ClientPortalProfileDto> {
    return this.map(await this.repository.update(requireClientPortalContext(context), input));
  }

  private map(row: {
    portal_name: string | null;
    primary_colour: string | null;
    sidebar_colour: string | null;
    surface_colour: string | null;
  }): ClientPortalProfileDto {
    return {
      portalName: row.portal_name ?? defaultProfile.portalName,
      primaryColour: row.primary_colour ?? defaultProfile.primaryColour,
      sidebarColour: row.sidebar_colour ?? defaultProfile.sidebarColour,
      surfaceColour: row.surface_colour ?? defaultProfile.surfaceColour,
    };
  }
}
