import { Injectable } from "@nestjs/common";

import { CreateExampleRequestDto, ExampleResponseDto } from "./example.dto";
import { ExamplePolicy } from "./example.policy";
import { ExampleRepository } from "./example.repository";

@Injectable()
export class ExampleService {
  constructor(
    private readonly examples: ExampleRepository,
    private readonly policy: ExamplePolicy,
  ) {}

  async create(dto: CreateExampleRequestDto): Promise<ExampleResponseDto> {
    this.policy.assertCanCreate(dto);
    return this.examples.insert(dto);
  }
}
