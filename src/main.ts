import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import { I18nValidationPipe } from 'nestjs-i18n'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { I18nValidationExceptionFilter } from './common/filters/i18n-validation-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(helmet())
  app.useGlobalPipes(new I18nValidationPipe({ transform: true }))
  app.useGlobalFilters(new HttpExceptionFilter(), new I18nValidationExceptionFilter())

  const config = new DocumentBuilder()
    .setTitle('Spaceflix API')
    .setDescription('The Spaceflix REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
