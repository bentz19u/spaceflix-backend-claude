import { Injectable, LoggerService, Logger } from '@nestjs/common'
import { getRequestId } from './request-context.storage'

@Injectable()
export class RequestLogger implements LoggerService {
  private logger: Logger
  private context?: string

  constructor() {
    this.logger = new Logger()
  }

  setContext(context: string) {
    this.context = context
    this.logger = new Logger(context)
  }

  private formatMessage(message: string): string {
    const requestId = getRequestId()
    return requestId ? `[${requestId}] ${message}` : message
  }

  log(message: string, ...optionalParams: unknown[]) {
    this.logger.log(this.formatMessage(message), ...optionalParams)
  }

  error(message: string, ...optionalParams: unknown[]) {
    this.logger.error(this.formatMessage(message), ...optionalParams)
  }

  warn(message: string, ...optionalParams: unknown[]) {
    this.logger.warn(this.formatMessage(message), ...optionalParams)
  }

  debug(message: string, ...optionalParams: unknown[]) {
    this.logger.debug(this.formatMessage(message), ...optionalParams)
  }

  verbose(message: string, ...optionalParams: unknown[]) {
    this.logger.verbose(this.formatMessage(message), ...optionalParams)
  }
}
