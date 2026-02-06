import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class IsRegistrableQueryDto {
  @ApiProperty({
    description: 'Email address to check',
    type: String,
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.REQUIRED') })
  @IsEmail({}, { message: i18nValidationMessage('validation.NOT_EMAIL') })
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
