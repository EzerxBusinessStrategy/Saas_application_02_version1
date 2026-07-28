import { ApiProperty } from '@nestjs/swagger';

export class ExampleRequestDto {
  @ApiProperty({ example: 'Example name' })
  name!: string;
}
