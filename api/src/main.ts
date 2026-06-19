import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // All routes are namespaced under /api/v1 for a stable, versioned contract.
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
  });

  // Global validation: strip unknown props, reject extras, auto-transform payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Swagger configuration for API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FlowDesk ERP API')
    .setDescription('FlowDesk Billing Approval Workflow API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name must match the security name in controllers
    )
    .addTag('auth', 'Authentication and authorization endpoints')
    .addTag('billing-requests', 'Billing request management endpoints')
    .addTag('invoices', 'Invoice management endpoints')
    .addTag('metrics', 'Dashboard metrics and reporting endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep authorization token across page refreshes
      tagsSorter: 'alpha', // Sort tags alphabetically
      operationsSorter: 'alpha', // Sort operations alphabetically
    },
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`FlowDesk API listening on http://localhost:${port}/api/v1`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

void bootstrap();
