import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { INVOICE_QUEUE } from '../queue/queue.constants';
import { InvoiceProcessor } from './invoice.processor';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuditModule, BullModule.registerQueue({ name: INVOICE_QUEUE })],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository, InvoiceProcessor],
  exports: [InvoicesService],
})
export class InvoicesModule {}
