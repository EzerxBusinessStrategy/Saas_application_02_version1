import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CreateExampleRequestDto, ExampleResponseDto } from "./example.dto";
import { ExampleService } from "./example.service";

@ApiTags("examples")
@Controller("/api/v1/examples")
export class ExampleController {
  constructor(private readonly examples: ExampleService) {}

  @Post()
  create(@Body() dto: CreateExampleRequestDto): Promise<ExampleResponseDto> {
    return this.examples.create(dto);
  }
}
