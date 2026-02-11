import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ErrorResponseDto {
  @ApiProperty({ description: 'Error code for programmatic handling' })
  code: string

  @ApiProperty({ description: 'Human-readable error description' })
  description: string

  @ApiPropertyOptional({ description: 'Request ID for tracking' })
  requestId?: string

  @ApiPropertyOptional({ description: 'Seconds to wait before retrying (for rate-limited requests)' })
  retryAfter?: number
}
