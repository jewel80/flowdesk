import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, BillingRequestStatus, Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { DashboardRepository } from './dashboard.repository';

/**
 * Response format for the PI status summary.
 * Contains counts for each status: SUBMITTED, APPROVED, REJECTED, INVOICED.
 */
export interface PIStatusSummary {
  SUBMITTED: number;
  APPROVED: number;
  REJECTED: number;
  INVOICED: number;
}

/**
 * Timeline entry representing a single activity in the daily timeline.
 */
interface TimelineEntry {
  id: string;
  action: AuditAction;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  timestamp: Date;
  timeLabel: string;
  actor: {
    id: string;
    name: string;
    role: Role;
  } | null;
  metadata: Prisma.JsonValue | null;
  billingRequest: {
    id: string;
    number: number;
    title: string;
    status: BillingRequestStatus;
  };
}

/**
 * Day-grouped timeline response.
 * Groups activities by date with labels: "Today", "Yesterday", or specific dates.
 */
export interface DailyTimelineResponse {
  date: string;
  dateLabel: string;
  entries: TimelineEntry[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly repository: DashboardRepository) {}

  /**
   * Returns PI status summary showing distribution of billing requests by status.
   * Sales users see only their own requests; Accounts and Managers see all requests.
   */
  async getStatusSummary(user: AuthenticatedUser): Promise<PIStatusSummary> {
    const scopedToSelf = user.role === Role.SALES;
    const where: Prisma.BillingRequestWhereInput = scopedToSelf
      ? { createdById: user.userId }
      : {};

    // Only count requests in relevant statuses (exclude DRAFT)
    where.status = {
      in: [
        BillingRequestStatus.SUBMITTED,
        BillingRequestStatus.APPROVED,
        BillingRequestStatus.REJECTED,
        BillingRequestStatus.INVOICED,
      ],
    };

    const grouped = await this.repository.getStatusCounts(where);

    // Zero-fill all statuses to ensure consistent response structure
    const statusCounts: PIStatusSummary = {
      SUBMITTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      INVOICED: 0,
    };

    for (const row of grouped) {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof PIStatusSummary] = row._count._all;
      }
    }

    this.logger.log(
      `Status summary for user ${user.userId} (role=${user.role}): ${JSON.stringify(statusCounts)}`,
    );

    return statusCounts;
  }

  /**
   * Returns daily timeline of status change activities.
   * Sales users see only their own requests; Accounts and Managers see all requests.
   */
  async getDailyTimeline(
    user: AuthenticatedUser,
    days: number = 30,
  ): Promise<DailyTimelineResponse[]> {
    const scopedToSelf = user.role === Role.SALES;
    const auditWhere: Prisma.AuditLogWhereInput = scopedToSelf
      ? { billingRequest: { createdById: user.userId } }
      : {};

    const entries = await this.repository.getTimelineActivity(auditWhere, days);

    this.logger.log(
      `Timeline for user ${user.userId} (role=${user.role}): ${entries.length} entries over ${days} days`,
    );

    return this.groupByDay(entries);
  }

  /**
   * Groups audit entries by day and transforms them for the timeline API response.
   * Entries are grouped as "Today", "Yesterday", or specific dates.
   * Adapted from BillingRequestsService.getHistory() pattern.
   */
  private groupByDay(entries: Awaited<ReturnType<typeof this.repository.getTimelineActivity>>) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Group entries by date key
    const grouped = new Map<string, typeof entries>();

    entries.forEach((entry) => {
      const entryDate = new Date(entry.createdAt);
      entryDate.setHours(0, 0, 0, 0);
      const dateKey = this.getDateKey(entryDate, today, yesterday);

      if (!grouped.has(dateKey.key)) {
        grouped.set(dateKey.key, []);
      }
      grouped.get(dateKey.key)!.push(entry);
    });

    // Transform to response format with proper ordering
    return Array.from(grouped.entries())
      .map(([key, entries]) => ({
        date: key,
        dateLabel: this.formatDateLabel(key, today, yesterday),
        entries: entries.map((e) => this.toTimelineEntry(e)),
      }))
      .sort((a, b) => {
        // Sort by date descending (most recent first)
        if (a.date === 'today') return -1;
        if (b.date === 'today') return 1;
        if (a.date === 'yesterday') return -1;
        if (b.date === 'yesterday') return 1;
        return b.date.localeCompare(a.date);
      });
  }

  /**
   * Determines the date key and label for an entry date.
   * Returns 'today', 'yesterday', or the ISO date string.
   */
  private getDateKey(entryDate: Date, today: Date, yesterday: Date): { key: string; label: string } {
    if (entryDate.getTime() === today.getTime()) {
      return { key: 'today', label: 'Today' };
    }
    if (entryDate.getTime() === yesterday.getTime()) {
      return { key: 'yesterday', label: 'Yesterday' };
    }
    const dateStr = entryDate.toISOString().split('T')[0];
    return { key: dateStr, label: this.formatSpecificDate(entryDate) };
  }

  /**
   * Formats a date label for specific dates (not today/yesterday).
   * Example: "June 15, 2026"
   */
  private formatSpecificDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Formats the date label based on the date key.
   */
  private formatDateLabel(key: string, today: Date, yesterday: Date): string {
    if (key === 'today') return 'Today';
    if (key === 'yesterday') return 'Yesterday';
    const date = new Date(key);
    return this.formatSpecificDate(date);
  }

  /**
   * Transforms an audit log entry into a timeline entry format.
   */
  private toTimelineEntry(entry: Awaited<ReturnType<typeof this.repository.getTimelineActivity>>[0]): TimelineEntry {
    const entryDate = new Date(entry.createdAt);
    return {
      id: entry.id,
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      timestamp: entry.createdAt,
      timeLabel: entryDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      actor: entry.actor
        ? {
            id: entry.actor.id,
            name: entry.actor.name,
            role: entry.actor.role,
          }
        : null,
      metadata: entry.metadata,
      billingRequest: {
        id: entry.billingRequest.id,
        number: entry.billingRequest.number,
        title: entry.billingRequest.title,
        status: entry.billingRequest.status,
      },
    };
  }
}
