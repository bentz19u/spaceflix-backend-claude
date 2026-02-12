import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { ApiConflictResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ErrorResponseDto } from '../common/dto/error-response.dto'
import { RequestLogger } from '../common/request-context/request-context.logger'
import { IsRegistrableQueryDto, IsRegistrableResponseDto } from './dto/is-registrable.dto'
import { RegisterStep1RequestDto, RegisterStep1ResponseDto } from './dto/register-step1.dto'
import { UserService } from './users.service'

@ApiTags('users')
@ApiHeader({
  name: 'x-custom-lang',
  description: 'Language for validation messages',
  required: false,
  enum: ['en', 'fr'],
})
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: RequestLogger,
  ) {
    this.logger.setContext(UserController.name)
  }

  @Get('is-registrable')
  @ApiOperation({ summary: 'Check if an email is available for registration' })
  @ApiOkResponse({ type: IsRegistrableResponseDto })
  async isRegistrable(@Query() query: IsRegistrableQueryDto): Promise<IsRegistrableResponseDto> {
    this.logger.log(`Checking registration for email: ${query.email}`)
    return this.userService.checkRegistrable(query.email)
  }

  @Post('register/step1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registration step 1 - validate email and password' })
  @ApiOkResponse({ type: RegisterStep1ResponseDto, description: 'Email and password validated successfully' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Email already registered' })
  async registerStep1(@Body() dto: RegisterStep1RequestDto): Promise<RegisterStep1ResponseDto> {
    return this.userService.registerStep1(dto)
  }
}
