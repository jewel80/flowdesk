import { Injectable } from '@nestjs/common';
import { Prisma, BillingRequestStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get status counts grouped by day for a specific month
   * Counts AuditLog entries where toStatus matches and createdAt falls on that day
   */
  async getStatusCountsByDayMonth(
    year: number,
    month: number,
    userId?: string,
    isSalesUser?: boolean,
  ): Promise<Array<{ date: string; toStatus: string; count: bigint }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      toStatus: {
        in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED'],
      },
    };

    // If Sales user, only count their own requests
    if (isSalesUser && userId) {
      where.billingRequest = {
        createdById: userId,
      };
    }

    const results = await this.prisma.reader.$queryRaw<Array<{ date: string; toStatus: string; count: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as date,
        "toStatus",
        COUNT(*) as count
      FROM "audit_logs"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        AND "toStatus" IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED')
        ${isSalesUser && userId ? Prisma.sql`AND "billingRequestId" IN (SELECT "id" FROM "billing_requests" WHERE "createdById" = ${userId})` : Prisma.empty}
      GROUP BY TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD'), "toStatus"
      ORDER BY date, "toStatus"
    `;

    return results;
  }

  /**
   * Get status counts for a specific date
   */
  async getStatusCountsForDate(
    date: Date,
    userId?: string,
    isSalesUser?: boolean,
  ): Promise<Array<{ toStatus: string; count: bigint }>> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      toStatus: {
        in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED'],
      },
    };

    // If Sales user, only count their own requests
    if (isSalesUser && userId) {
      where.billingRequest = {
        createdById: userId,
      };
    }

    const results = await this.prisma.reader.auditLog.groupBy({
      by: ['toStatus'],
      where,
      _count: {
        toStatus: true,
      },
    });

    return results
      .filter((result) => result.toStatus !== null)
      .map((result) => ({
        toStatus: result.toStatus as string,
        count: BigInt(result._count.toStatus),
      }));
  }

  /**
   * Get all days in a month for filling in zero-count days
   */
  getDaysInMonth(year: number, month: number): Date[] {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: Date[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month - 1, day));
    }
    return days;
  }
}
