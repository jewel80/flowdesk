import { Injectable } from '@nestjs/common';
import {
  BillingRequestStatus,
  InvoiceStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toMajorUnits } from '../../common/utils/money';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard summary. Sales users see metrics for their own requests only;
   * Accounts and Managers see organisation-wide figures.
   */
  async summary(user: AuthenticatedUser) {
    const scopedToSelf = user.role === Role.SALES;
    const requestWhere: Prisma.BillingRequestWhereInput = scopedToSelf
      ? { createdById: user.userId }
      : {};
    const invoiceWhere: Prisma.InvoiceWhereInput = scopedToSelf
      ? { billingRequest: { createdById: user.userId } }
      : {};

    const [grouped, totalRequests, issuedAgg, paidAgg] = await Promise.all([
      this.prisma.billingRequest.groupBy({
        by: ['status'],
        where: requestWhere,
        _count: { _all: true },
      }),
      this.prisma.billingRequest.count({ where: requestWhere }),
      this.prisma.invoice.aggregate({
        where: { ...invoiceWhere, status: InvoiceStatus.ISSUED },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...invoiceWhere, status: InvoiceStatus.PAID },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
    ]);

    // Ensure every status appears, even with a zero count.
    const requestsByStatus = Object.fromEntries(
      Object.values(BillingRequestStatus).map((status) => [status, 0]),
    ) as Record<BillingRequestStatus, number>;
    for (const row of grouped) {
      requestsByStatus[row.status] = row._count._all;
    }

    return {
      scope: scopedToSelf ? 'self' : 'organisation',
      requests: {
        total: totalRequests,
        byStatus: requestsByStatus,
        pendingReview: requestsByStatus[BillingRequestStatus.SUBMITTED],
      },
      invoices: {
        outstandingCount: issuedAgg._count._all,
        outstandingAmount: toMajorUnits(issuedAgg._sum.amountCents ?? 0),
        paidCount: paidAgg._count._all,
        paidAmount: toMajorUnits(paidAgg._sum.amountCents ?? 0),
      },
    };
  }
}
