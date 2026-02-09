import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import { I18nValidationException } from 'nestjs-i18n'
import { Response } from 'express'
import { getRequestId } from '../request-context/request-context.storage'

@Catch(I18nValidationException)
export class I18nValidationExceptionFilter implements ExceptionFilter {
  catch(exception: I18nValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    const errors = exception.errors.map((error) => ({
      property: error.property,
      constraints: error.constraints ? Object.values(error.constraints) : [],
    }))

    response.status(400).json({
      statusCode: 400,
      message: 'Validation failed',
      errors,
      requestId: getRequestId(),
    })
  }
}
