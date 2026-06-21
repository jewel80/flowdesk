import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

// Any client that can issue queries: the primary, a read replica, or a tx client.
type Client = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates billing requests by status for the PI status summary.
   * Uses read replica for analytics queries.
   */
  async getStatusCounts(where: Prisma.BillingRequestWhereInput) {
    const reader = this.prisma.reader;
    return reader.billingRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
  }

  /**
   * Fetches audit log entries for the daily timeline within the specified day range.
   * Uses read replica for analytics queries.
   */
  async getTimelineActivity(
    where: Prisma.AuditLogWhereInput,
    days: number = 30,
  ) {
    const reader = this.prisma.reader;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    return reader.auditLog.findMany({
      where: {
        ...where,
        createdAt: { gte: cutoffDate },
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        billingRequest: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
