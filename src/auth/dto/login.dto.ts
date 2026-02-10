import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class LoginRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  login: string

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean
}
