import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExampleRequestDto } from './request-dto';
import { ExampleResponseDto } from './response-dto';

@ApiTags('examples')
@Controller('/api/v1/examples')
export class ExampleController {
  @Post()
  @ApiOperation({ summary: 'Create an example resource' })
  @ApiCreatedResponse({ type: ExampleResponseDto })
  create(@Body() body: ExampleRequestDto): ExampleResponseDto {
    return { id: '00000000-0000-0000-0000-000000000000', name: body.name };
  }
}
