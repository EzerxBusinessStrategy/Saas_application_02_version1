import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageInfoDto {
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class PaginatedResponseDto<TItem> {
  items!: TItem[];

  @ApiProperty({ type: PageInfoDto })
  page!: PageInfoDto;
}
