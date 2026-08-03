import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";
import { LiveHealthResponseDto, ReadyHealthResponseDto } from "./health.dto";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("live")
  @ApiOkResponse({ type: LiveHealthResponseDto })
  live(): LiveHealthResponseDto {
    return this.healthService.live();
  }

  @Get("ready")
  @ApiOkResponse({ type: ReadyHealthResponseDto })
  ready(): Promise<ReadyHealthResponseDto> {
    return this.healthService.ready();
  }
}
