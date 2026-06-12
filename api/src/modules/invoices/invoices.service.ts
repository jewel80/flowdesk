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
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { InvoicesRepository } from './invoices.repository';
import { buildInvoiceNumber, toInvoiceResponse } from './invoice.mapper';

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

      const invoice = await this.repository.create(
        {
          amountCents: request.amountCents,
          currency: request.currency,
          status: InvoiceStatus.ISSUED,
          dueDate,
          billingRequest: { connect: { id: request.id } },
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

  async findAll(user: AuthenticatedUser) {
    const where =
      user.role === Role.SALES
        ? { billingRequest: { createdById: user.userId } }
        : {};
    const invoices = await this.repository.findMany(where);
    return invoices.map(toInvoiceResponse);
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
