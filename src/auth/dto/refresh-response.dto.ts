import { ApiProperty } from '@nestjs/swagger'

export class RefreshResponseDto {
  @ApiProperty({ description: 'New short-lived access token' })
  accessToken: string

  @ApiProperty({ description: 'New refresh token (rotated)' })
  refreshToken: string
}
