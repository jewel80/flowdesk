import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService],
  // Exported so the billing-requests and invoices workflows can record events.
  exports: [AuditService],
})
export class AuditModule {}
