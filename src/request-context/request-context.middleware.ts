import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { requestContextStorage } from './request-context.storage'

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()

    res.setHeader('x-request-id', requestId)

    requestContextStorage.run({ requestId }, () => {
      next()
    })
  }
}
