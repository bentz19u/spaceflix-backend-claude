import { ApiProperty } from '@nestjs/swagger'

export class LoginResponseDto {
  @ApiProperty({ description: 'Short-lived access token' })
  accessToken: string

  @ApiProperty({ description: 'Longer-lived refresh token' })
  refreshToken: string
}
