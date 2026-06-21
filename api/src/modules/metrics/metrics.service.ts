import { Injectable, Logger } from '@nestjs/common';
import {
  BillingRequestStatus,
  InvoiceStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toMajorUnits } from '../../common/utils/money';
import { AuthenticatedUser } from '../auth/auth.types';
import { MetricsRepository } from './metrics.repository';
import {
  DayStatusData,
  DailyBreakdownResponse,
  MonthlyTrendResponse,
} from './dto/metrics-query.dto';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: MetricsRepository,
  ) {}

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

    // Dashboard aggregates are read-only and well suited to a read replica.
    const reader = this.prisma.reader;
    const [grouped, totalRequests, issuedAgg, paidAgg] = await Promise.all([
      reader.billingRequest.groupBy({
        by: ['status'],
        where: requestWhere,
        _count: { _all: true },
      }),
      reader.billingRequest.count({ where: requestWhere }),
      reader.invoice.aggregate({
        where: { ...invoiceWhere, status: InvoiceStatus.ISSUED },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      reader.invoice.aggregate({
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

  /**
   * Get monthly status trend - day-wise counts per status
   */
  async getDailyStatusTrend(
    month: string,
    user: AuthenticatedUser,
  ): Promise<MonthlyTrendResponse> {
    const [year, monthNum] = month.split('-').map(Number);
    const isSalesUser = user.role === Role.SALES;

    this.logger.log(
      `Fetching daily status trend for ${month} for user ${user.userId} (${user.role})`,
    );

    const results = await this.repository.getStatusCountsByDayMonth(
      year,
      monthNum,
      user.userId,
      isSalesUser,
    );

    // Transform results into the expected format
    const daysMap = new Map<string, DayStatusData>();

    // Initialize all days of the month with zero counts
    const daysInMonth = this.repository.getDaysInMonth(year, monthNum);
    for (const day of daysInMonth) {
      const dateStr = day.toISOString().split('T')[0];
      daysMap.set(dateStr, {
        date: dateStr,
        SUBMITTED: 0,
        APPROVED: 0,
        REJECTED: 0,
        INVOICED: 0,
      });
    }

    // Fill in actual counts
    for (const row of results) {
      const dateStr = row.date.toString().split('T')[0]; // Handle Date to string conversion
      const existing = daysMap.get(dateStr);
      if (existing) {
        const count = Number(row.count);
        const status = row.toStatus;
        const updated = { ...existing };
        if (status === 'SUBMITTED') updated.SUBMITTED = count;
        else if (status === 'APPROVED') updated.APPROVED = count;
        else if (status === 'REJECTED') updated.REJECTED = count;
        else if (status === 'INVOICED') updated.INVOICED = count;
        daysMap.set(dateStr, updated);
      }
    }

    return {
      month,
      days: Array.from(daysMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    };
  }

  /**
   * Get status breakdown for a specific date
   */
  async getDailyStatusBreakdown(
    date: string,
    user: AuthenticatedUser,
  ): Promise<DailyBreakdownResponse> {
    const dateObj = new Date(date);
    const isSalesUser = user.role === Role.SALES;

    this.logger.log(
      `Fetching daily status breakdown for ${date} for user ${user.userId} (${user.role})`,
    );

    const results = await this.repository.getStatusCountsForDate(
      dateObj,
      user.userId,
      isSalesUser,
    );

    // Initialize with zero counts
    const breakdown: DailyBreakdownResponse = {
      date,
      SUBMITTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      INVOICED: 0,
    };

    // Fill in actual counts
    for (const row of results) {
      const status = row.toStatus;
      const count = Number(row.count);
      if (status === 'SUBMITTED') breakdown.SUBMITTED = count;
      else if (status === 'APPROVED') breakdown.APPROVED = count;
      else if (status === 'REJECTED') breakdown.REJECTED = count;
      else if (status === 'INVOICED') breakdown.INVOICED = count;
    }

    return breakdown;
  }
}
