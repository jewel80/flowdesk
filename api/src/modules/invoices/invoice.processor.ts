import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  GenerateInvoiceJobData,
  INVOICE_JOBS,
  INVOICE_QUEUE,
} from '../queue/queue.constants';
import { InvoicesService } from './invoices.service';

/**
 * Background worker for the invoice queue. Approval enqueues a job here; the
 * heavy/failure-prone work (invoice creation + notification) happens out of the
 * request path and is automatically retried per the queue's job options.
 */
@Processor(INVOICE_QUEUE)
export class InvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(private readonly invoicesService: InvoicesService) {
    super();
  }

  async process(job: Job<GenerateInvoiceJobData>): Promise<void> {
    if (job.name !== INVOICE_JOBS.GENERATE) {
      this.logger.warn(`Unknown job ${job.name}; ignoring`);
      return;
    }

    const { billingRequestId, approvedByUserId } = job.data;
    this.logger.log(`Generating invoice for request ${billingRequestId}`);

    const invoice = await this.invoicesService.generateForRequest(
      billingRequestId,
      approvedByUserId,
    );

    // Simulated notification — in production this would be email/Slack/webhook.
    this.logger.log(
      `[NOTIFICATION] Invoice ${invoice.invoiceNumber} (${invoice.currency} ${invoice.amount}) issued for "${invoice.billingRequest.title}"`,
    );
  }
}
