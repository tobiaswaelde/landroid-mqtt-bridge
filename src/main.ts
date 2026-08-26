import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import 'reflect-metadata';
import { ENV } from '~/config/env';

const logger = new Logger('APP');

/** Starts the HTTP API and the configured bridge instances. */
async function bootstrap() {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // configuration
  app.enableShutdownHooks();

  // middlewares
  app.enableCors({ allowedHeaders: ['*'], origin: ENV.CORS_ORIGIN });

  // start app
  await app.listen(ENV.PORT, ENV.HOST);
  logger.log(`Application is running on ${await app.getUrl()}`);
}

void bootstrap();
