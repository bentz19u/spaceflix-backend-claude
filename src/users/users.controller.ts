import { Controller, Get, Query } from '@nestjs/common'
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsRegistrableQueryDto, IsRegistrableResponseDto } from './dto/is-registrable.dto'
import { RequestLogger } from '../common/request-context/request-context.logger'
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
}
