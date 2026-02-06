import { ApiProperty } from '@nestjs/swagger'
import { IsEmail } from 'class-validator'

export class IsRegistrableQueryDto {
  @ApiProperty({
    description: 'Email address to check',
    type: String,
    example: 'user@example.com',
  })
  @IsEmail()
  email: string
}

export class IsRegistrableResponseDto {
  @ApiProperty({
    description: 'Whether the email is available for registration',
    type: Boolean,
    example: true,
  })
  isAvailable: boolean

  @ApiProperty({
    description: 'Whether the user exists but needs activation',
    type: Boolean,
    example: false,
  })
  canActivate: boolean
}
