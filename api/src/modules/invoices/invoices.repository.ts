import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByRequestId(billingRequestId: string, client: Client = this.prisma) {
    return client.invoice.findUnique({
      where: { billingRequestId },
      include: INVOICE_INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
  }

  create(data: Prisma.InvoiceCreateInput, client: Client = this.prisma) {
    return client.invoice.create({ data, include: INVOICE_INCLUDE });
  }

  update(id: string, data: Prisma.InvoiceUpdateInput, client: Client = this.prisma) {
    return client.invoice.update({ where: { id }, data, include: INVOICE_INCLUDE });
  }

  findMany(where: Prisma.InvoiceWhereInput) {
    return this.prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }
}
