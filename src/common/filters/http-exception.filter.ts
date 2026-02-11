import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'
import { getRequestId } from '../request-context/request-context.storage'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    this.logger.error('Exception caught:', exception)

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' }

    const errorResponse =
      typeof exceptionResponse === 'string' ? { message: exceptionResponse } : { ...exceptionResponse }

    response.status(status).json({
      ...errorResponse,
      requestId: getRequestId(),
    })
  }
}
