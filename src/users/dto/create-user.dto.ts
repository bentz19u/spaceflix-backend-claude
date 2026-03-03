import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'
import { UserPlanEnum } from '../user-plan.enum'

export class CreateUserRequestDto {
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

  @ApiProperty({
    description: 'Subscription plan',
    enum: UserPlanEnum,
    example: UserPlanEnum.STANDARD,
  })
  @IsNotEmpty({ message: i18nValidationMessage('validation.REQUIRED') })
  @IsEnum(UserPlanEnum, { message: i18nValidationMessage('validation.NOT_ENUM') })
  plan: UserPlanEnum
}

export class CreateUserResponseDto {
  @ApiProperty({
    description: 'The created user ID',
    type: Number,
    example: 1,
  })
  id: number
}
