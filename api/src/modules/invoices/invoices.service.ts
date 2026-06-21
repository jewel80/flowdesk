import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  BillingRequestStatus,
  InvoiceStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { InvoicesRepository } from './invoices.repository';
import { buildInvoiceNumber, toInvoiceResponse } from './invoice.mapper';
import { QueryInvoicesDto } from './dto/query-invoices.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: InvoicesRepository,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) { }

  /**
   * Generates the invoice for an APPROVED request and moves it to INVOICED.
   * Invoked by the async worker. Idempotent: if an invoice already exists for
   * the request (e.g. a retried job) the existing one is returned unchanged.
   */
  async generateForRequest(billingRequestId: string, approvedByUserId: string) {
    return this.prisma.primary.$transaction(async (tx) => {
      const request = await tx.billingRequest.findUnique({
        where: { id: billingRequestId },
      });
      if (!request) {
        throw new NotFoundException(`Billing request ${billingRequestId} not found`);
      }

      const existing = await this.repository.findByRequestId(billingRequestId, tx);
      if (existing) {
        this.logger.warn(
          `Invoice already exists for request ${billingRequestId}; skipping`,
        );
        return toInvoiceResponse(existing);
      }

      if (request.status !== BillingRequestStatus.APPROVED) {
        throw new ConflictException(
          `Cannot invoice a request in status ${request.status}`,
        );
      }

      const dueInDays = this.config.get<number>('invoice.dueInDays') ?? 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueInDays);

      // Build invoice with enhanced fields
      // For now, use a simple line item structure - this can be enhanced later
      const subtotalCents = request.amountCents;
      const discountCents = 0;
      const taxRatePercent = 0; // No tax by default
      const taxAmountCents = 0;
      const totalCents = subtotalCents - discountCents + taxAmountCents;

      // Populate bill-to snapshot from the billing request
      const billToName = request.customerName;
      const billToAddress = 'Customer Address'; // This would come from customer profile in production
      const billToEmail = null; // Would come from customer profile
      const billToPhone = null; // Would come from customer profile

      // Populate issuer snapshot - in production this would come from company settings
      const issuerName = 'FlowDesk Inc.';
      const issuerAddress = '123 Business St, Suite 100, San Francisco, CA 94105';
      const issuerTaxId = null;
      const issuerEmail = 'billing@flowdesk.com';
      const issuerPhone = '+1-555-123-4567';

      const invoice = await this.repository.create(
        {
          amountCents: request.amountCents,
          currency: request.currency,
          status: InvoiceStatus.ISSUED,
          dueDate,
          // Enhanced fields
          billToName,
          billToAddress,
          billToEmail,
          billToPhone,
          issuerName,
          issuerAddress,
          issuerTaxId,
          issuerEmail,
          issuerPhone,
          subtotalCents,
          discountCents,
          taxRatePercent,
          taxAmountCents,
          totalCents,
          paymentTerms: `Net ${dueInDays}`,
          notes: 'Thank you for your business.',
          billingRequest: { connect: { id: request.id } },
          lineItems: {
            create: [
              {
                description: request.title || (request.description ? request.description.substring(0, 100) : 'Services'),
                quantity: 1,
                unitPriceCents: request.amountCents,
                amountCents: request.amountCents,
                sortOrder: 0,
              },
            ],
          },
        },
        tx,
      );

      await tx.billingRequest.update({
        where: { id: request.id },
        data: { status: BillingRequestStatus.INVOICED },
      });

      await this.auditService.record(
        {
          billingRequestId: request.id,
          action: AuditAction.INVOICE_GENERATED,
          actorId: approvedByUserId,
          fromStatus: BillingRequestStatus.APPROVED,
          toStatus: BillingRequestStatus.INVOICED,
          note: 'Invoice generated',
          metadata: { invoiceNumber: buildInvoiceNumber(invoice) },
        },
        tx,
      );

      return toInvoiceResponse(invoice);
    });
  }

  async findAll(user: AuthenticatedUser, query: QueryInvoicesDto) {
    const where: Prisma.InvoiceWhereInput =
      user.role === Role.SALES
        ? { billingRequest: { createdById: user.userId } }
        : {};

    // Add search condition if provided
    if (query.search) {
      const searchTerm = query.search;
      where.OR = [
        { billToName: { contains: searchTerm, mode: 'insensitive' } },
        { billingRequest: { title: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.repository.findManyWithCount(
      where,
      page,
      pageSize,
    );

    return {
      data: items.map(toInvoiceResponse),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const invoice = await this.repository.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    if (
      user.role === Role.SALES &&
      invoice.billingRequest.createdById !== user.userId
    ) {
      throw new ForbiddenException('You can only view your own invoices');
    }
    return toInvoiceResponse(invoice);
  }

  async markPaid(id: string, user: AuthenticatedUser) {
    const invoice = await this.repository.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new ConflictException(
        `Only ISSUED invoices can be marked paid (current: ${invoice.status})`,
      );
    }

    return this.prisma.primary.$transaction(async (tx) => {
      const updated = await this.repository.update(
        id,
        { status: InvoiceStatus.PAID, paidAt: new Date() },
        tx,
      );
      await this.auditService.record(
        {
          billingRequestId: invoice.billingRequestId,
          action: AuditAction.INVOICE_PAID,
          actorId: user.userId,
          note: 'Invoice marked as paid',
          metadata: { invoiceNumber: buildInvoiceNumber(invoice) },
        },
        tx,
      );
      return toInvoiceResponse(updated);
    });
  }
}
