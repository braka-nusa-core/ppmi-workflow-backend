import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalException } from './common/exceptions/global.exception';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TransformIdInterceptor } from './common/interceptors/transform-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });

  const config = new DocumentBuilder()
    .setTitle('PPMI Workflow API Documentation')
    .setDescription('The PPMI Workflow API documentation')
    .setVersion('2.0')
    .addTag('PPMI')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  app.use(urlencoded({ extended: true, limit: '5mb' }));
  app.useGlobalFilters(new GlobalException(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(
    new TransformIdInterceptor(),
    new ResponseInterceptor(),
  );
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
