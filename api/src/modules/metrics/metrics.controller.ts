import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { MetricsService } from './metrics.service';
import { DailyStatusTrendDto, DailyStatusBreakdownDto } from './dto/metrics-query.dto';

@ApiTags('metrics')
@ApiBearerAuth('JWT-auth')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly service: MetricsService) { }

  @Get('summary')
  @ApiOperation({
    summary: 'Get dashboard metrics summary',
    description: 'Returns aggregated metrics for the dashboard. Sales users see only their own metrics. Accounts and Manager roles see organization-wide metrics.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics retrieved successfully',
    schema: {
      example: {
        totalRequests: 25,
        pendingApproval: 3,
        approved: 15,
        rejected: 2,
        invoiced: 15,
        totalAmountCents: 3750000,
        pendingInvoices: 8,
        paidInvoices: 7
      }
    }
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(user);
  }

  @Get('daily-status-trend')
  @ApiOperation({
    summary: 'Get daily status trend for a month',
    description: 'Returns day-wise counts of status transitions (SUBMITTED, APPROVED, REJECTED, INVOICED) for a given month. Data is derived from audit log entries where toStatus matches the calendar day. Sales users see only their own requests; Managers see all.'
  })
  @ApiQuery({ name: 'month', required: false, description: 'Month in YYYY-MM format (defaults to current month)', example: '2026-06' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daily status trend retrieved successfully',
    schema: {
      example: {
        month: '2026-06',
        days: [
          { date: '2026-06-01', SUBMITTED: 3, APPROVED: 1, REJECTED: 0, INVOICED: 1 },
          { date: '2026-06-02', SUBMITTED: 2, APPROVED: 3, REJECTED: 1, INVOICED: 0 }
        ]
      }
    }
  })
  async getDailyStatusTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyStatusTrendDto,
  ) {
    const month = query.month || new Date().toISOString().slice(0, 7);
    return this.service.getDailyStatusTrend(month, user);
  }

  @Get('daily-status-breakdown')
  @ApiOperation({
    summary: 'Get status breakdown for a specific date',
    description: 'Returns counts of status transitions (SUBMITTED, APPROVED, REJECTED, INVOICED) for a specific calendar date. Data is derived from audit log entries where toStatus matches the date. Sales users see only their own requests; Managers see all.'
  })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format (defaults to today)', example: '2026-06-21' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daily status breakdown retrieved successfully',
    schema: {
      example: {
        date: '2026-06-21',
        SUBMITTED: 2,
        APPROVED: 1,
        REJECTED: 0,
        INVOICED: 1
      }
    }
  })
  async getDailyStatusBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyStatusBreakdownDto,
  ) {
    const date = query.date || new Date().toISOString().slice(0, 10);
    return this.service.getDailyStatusBreakdown(date, user);
  }
}
