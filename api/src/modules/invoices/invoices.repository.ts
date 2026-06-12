import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const INVOICE_INCLUDE = {
  billingRequest: {
    select: {
      id: true,
      title: true,
      customerName: true,
      number: true,
      createdAt: true,
      createdById: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

// Any client that can issue queries: the primary, a read replica, or a tx client.
type Client = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) { }

  // Read: defaults to a replica, but callers inside a write transaction (e.g. the
  // idempotency check in invoice generation) pass the tx client to hit the primary.
  findByRequestId(billingRequestId: string, client: Client = this.prisma.reader) {
    return client.invoice.findUnique({
      where: { billingRequestId },
      include: INVOICE_INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.reader.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
  }

  create(data: Prisma.InvoiceCreateInput, client: Client = this.prisma.primary) {
    return client.invoice.create({ data, include: INVOICE_INCLUDE });
  }

  update(id: string, data: Prisma.InvoiceUpdateInput, client: Client = this.prisma.primary) {
    return client.invoice.update({ where: { id }, data, include: INVOICE_INCLUDE });
  }

  findMany(where: Prisma.InvoiceWhereInput) {
    return this.prisma.reader.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }
}
