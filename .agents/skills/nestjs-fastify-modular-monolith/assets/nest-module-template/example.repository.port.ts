import { CreateExampleRequestDto, ExampleResponseDto } from "./example.dto";

export interface ExampleRepositoryPort {
  insert(dto: CreateExampleRequestDto): Promise<ExampleResponseDto>;
}
