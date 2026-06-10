import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Standard relation set returned for a billing request. */
const REQUEST_INCLUDE = {
  createdBy: { select: { id: true, name: true, role: true } },
  reviewedBy: { select: { id: true, name: true, role: true } },
  invoice: true,
} satisfies Prisma.BillingRequestInclude;

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class BillingRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Run a unit of work atomically (status change + audit entry together). */
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  create(data: Prisma.BillingRequestCreateInput, client: Client = this.prisma) {
    return client.billingRequest.create({
      data,
      include: REQUEST_INCLUDE,
    });
  }

  findById(id: string, client: Client = this.prisma) {
    return client.billingRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
  }

  update(
    id: string,
    data: Prisma.BillingRequestUpdateInput,
    client: Client = this.prisma,
  ) {
    return client.billingRequest.update({
      where: { id },
      data,
      include: REQUEST_INCLUDE,
    });
  }

  async findManyWithCount(where: Prisma.BillingRequestWhereInput, page: number, pageSize: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.billingRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.billingRequest.count({ where }),
    ]);
    return { items, total };
  }
}
