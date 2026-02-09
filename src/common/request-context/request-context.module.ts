import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { RequestContextMiddleware } from './request-context.middleware'
import { RequestLogger } from './request-context.logger'

@Global()
@Module({
  providers: [RequestLogger],
  exports: [RequestLogger],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
