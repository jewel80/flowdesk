import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { BillingRequestsModule } from './modules/billing-requests/billing-requests.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { AuditModule } from './modules/audit/audit.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { QueueModule } from './modules/queue/queue.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      // Load environment-specific overrides first, then a shared .env fallback.
      // Variables already present in process.env (e.g. injected by Docker) always
      // win, so this is safe in containers where no .env file is shipped.
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env',
      ],
    }),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    BillingRequestsModule,
    InvoicesModule,
    AuditModule,
    MetricsModule,
    HealthModule,
  ],
  providers: [
    // Authentication is on by default for every route; opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Authorization runs after authentication; enforced via @Roles().
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
