import { Injectable } from "@nestjs/common";

import { CreateExampleRequestDto, ExampleResponseDto } from "./example.dto";
import { ExampleRepositoryPort } from "./example.repository.port";

@Injectable()
export class ExampleRepository implements ExampleRepositoryPort {
  async insert(dto: CreateExampleRequestDto): Promise<ExampleResponseDto> {
    return { id: "example-id", name: dto.name };
  }
}
