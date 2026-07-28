import { ApiProperty } from '@nestjs/swagger';

export class ExampleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}
