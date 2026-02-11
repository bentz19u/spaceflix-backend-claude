import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { AUTH_ERRORS } from './auth.errors'
import { AuthService } from './auth.service'
import type { JwtPayload } from './auth.service'
import { CurrentUser } from './decorators/current-user.decorator'
import { LoginRequestDto } from './dto/login.dto'
import { LoginResponseDto } from './dto/login-response.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiHeader({ name: 'remote_addr', description: 'Client IP address', required: true })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Login successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiForbiddenResponse({ description: 'Too many failed attempts' })
  async login(@Body() dto: LoginRequestDto, @Headers('remote_addr') remoteAddr: string): Promise<LoginResponseDto> {
    if (!remoteAddr) {
      throw new BadRequestException(AUTH_ERRORS.LOGIN.MISSING_REMOTE_ADDR)
    }
    return this.authService.login(dto, remoteAddr)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiHeader({ name: 'remote_addr', description: 'Client IP address', required: true })
  @ApiOkResponse({ description: 'Logout successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing access token' })
  async logout(@CurrentUser() user: JwtPayload, @Headers('remote_addr') remoteAddr: string): Promise<void> {
    if (!remoteAddr) {
      throw new BadRequestException(AUTH_ERRORS.LOGOUT.MISSING_REMOTE_ADDR)
    }
    await this.authService.logout(user.sub, remoteAddr)
  }
}
