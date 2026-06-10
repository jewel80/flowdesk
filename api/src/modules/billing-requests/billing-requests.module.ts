import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { INVOICE_QUEUE } from '../queue/queue.constants';
import { BillingRequestsController } from './billing-requests.controller';
import { BillingRequestsRepository } from './billing-requests.repository';
import { BillingRequestsService } from './billing-requests.service';

@Module({
  imports: [AuditModule, BullModule.registerQueue({ name: INVOICE_QUEUE })],
  controllers: [BillingRequestsController],
  providers: [BillingRequestsService, BillingRequestsRepository],
  exports: [BillingRequestsService],
})
export class BillingRequestsModule {}
