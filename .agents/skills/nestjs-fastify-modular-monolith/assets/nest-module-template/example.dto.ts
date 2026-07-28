import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateExampleRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ExampleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}
