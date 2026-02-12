import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class RegisterStep1RequestDto {
  @ApiProperty({
    description: 'Email address for registration',
    type: String,
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.REQUIRED') })
  @IsEmail({}, { message: i18nValidationMessage('validation.NOT_EMAIL') })
  email: string

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    type: String,
    example: 'password123',
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.REQUIRED') })
  @IsString({ message: i18nValidationMessage('validation.NOT_STRING') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  password: string
}

export class RegisterStep1ResponseDto {
  @ApiProperty({
    description: 'Whether the user can reactivate a soft-deleted account',
    type: Boolean,
    example: false,
  })
  canActivate: boolean
}
