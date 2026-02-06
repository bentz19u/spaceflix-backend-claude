import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new I18nValidationPipe({ transform: true }))
  app.useGlobalFilters(new I18nValidationExceptionFilter())

  const config = new DocumentBuilder()
    .setTitle('Spaceflix API')
    .setDescription('The Spaceflix REST API')
    .setVersion('1.0')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
