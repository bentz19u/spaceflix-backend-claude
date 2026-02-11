import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import * as short from 'short-uuid'
import { requestContextStorage } from './request-context.storage'

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'creditcard',
  'credit_card',
]

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP')

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || short.generate()

    res.setHeader('x-request-id', requestId)

    const { method, originalUrl } = req
    const body = req.body as Record<string, unknown> | undefined
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(body ?? {}).length > 0
    const bodyLog = hasBody ? ` Body: ${JSON.stringify(this.sanitizeBody(body ?? {}))}` : ''

    this.logger.log(`[${requestId}] INCOMING ${method} ${originalUrl}${bodyLog}`)

    requestContextStorage.run({ requestId }, () => {
      next()
    })
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeBody(value as Record<string, unknown>)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }
}
