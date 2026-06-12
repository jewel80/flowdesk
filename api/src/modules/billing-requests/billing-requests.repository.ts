import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Standard relation set returned for a billing request. */
const REQUEST_INCLUDE = {
  createdBy: { select: { id: true, name: true, role: true } },
  reviewedBy: { select: { id: true, name: true, role: true } },
  invoice: true,
} satisfies Prisma.BillingRequestInclude;

// Any client that can issue queries: the primary, a read replica, or a tx client.
type Client = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class BillingRequestsRepository {
  constructor(private readonly prisma: PrismaService) { }

  /** Run a unit of work atomically (status change + audit entry together). */
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.primary.$transaction(fn);
  }

  create(data: Prisma.BillingRequestCreateInput, client: Client = this.prisma.primary) {
    return client.billingRequest.create({
      data,
      include: REQUEST_INCLUDE,
    });
  }

  // Read: defaults to a replica unless a specific client (e.g. a tx) is passed.
  findById(id: string, client: Client = this.prisma.reader) {
    return client.billingRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
  }

  update(
    id: string,
    data: Prisma.BillingRequestUpdateInput,
    client: Client = this.prisma.primary,
  ) {
    return client.billingRequest.update({
      where: { id },
      data,
      include: REQUEST_INCLUDE,
    });
  }

  async findManyWithCount(where: Prisma.BillingRequestWhereInput, page: number, pageSize: number) {
    // Read path: list + count batched on a single replica connection.
    const reader = this.prisma.reader;
    const [items, total] = await reader.$transaction([
      reader.billingRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      reader.billingRequest.count({ where }),
    ]);
    return { items, total };
  }
}
