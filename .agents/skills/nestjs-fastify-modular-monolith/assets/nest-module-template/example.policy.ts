import { Injectable } from "@nestjs/common";

import { CreateExampleRequestDto } from "./example.dto";

@Injectable()
export class ExamplePolicy {
  assertCanCreate(dto: CreateExampleRequestDto): void {
    if (!dto.name.trim()) throw new Error("Name is required.");
  }
}
