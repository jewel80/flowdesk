import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { DashboardService, PIStatusSummary, DailyTimelineResponse } from './dashboard.service';

/**
 * Dashboard HTTP boundary.
 * Provides organization-wide PI status overview and daily activity timeline.
 * Sales users see only their own data; Accounts and Managers see all organization data.
 */
@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('status-summary')
  @Roles(Role.MANAGER, Role.ACCOUNTS, Role.SALES)
  @ApiOperation({
    summary: 'Get PI status summary',
    description:
      'Returns the distribution of billing requests by status (SUBMITTED, APPROVED, REJECTED, INVOICED). ' +
      'Sales users see only their own requests; Accounts and Managers see all organization requests.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status summary retrieved successfully',
    schema: {
      example: {
        SUBMITTED: 5,
        APPROVED: 12,
        REJECTED: 2,
        INVOICED: 8,
      },
    },
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  async getStatusSummary(@CurrentUser() user: AuthenticatedUser): Promise<PIStatusSummary> {
    return this.service.getStatusSummary(user);
  }

  @Get('daily-timeline')
  @Roles(Role.MANAGER, Role.ACCOUNTS, Role.SALES)
  @ApiOperation({
    summary: 'Get daily activity timeline',
    description:
      'Returns a day-wise grouped timeline of status change activities. ' +
      'Each group contains activities for that day with actor information. ' +
      'Sales users see only their own requests; Accounts and Managers see all organization activities.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to look back (default: 30)',
    type: Number,
    example: 30,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daily timeline retrieved successfully',
    schema: {
      example: {
        data: [
          {
            date: 'today',
            dateLabel: 'Today',
            entries: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                action: 'APPROVED',
                fromStatus: 'SUBMITTED',
                toStatus: 'APPROVED',
                note: null,
                timestamp: '2026-06-21T14:30:00.000Z',
                timeLabel: '2:30 PM',
                actor: {
                  id: '550e8400-e29b-41d4-a716-446655440001',
                  name: 'Accounts Manager',
                  role: 'ACCOUNTS',
                },
                metadata: null,
                billingRequest: {
                  id: '550e8400-e29b-41d4-a716-446655440002',
                  number: 42,
                  title: 'Monthly services',
                  status: 'APPROVED',
                },
              },
            ],
          },
          {
            date: '2026-06-20',
            dateLabel: 'June 20, 2026',
            entries: [
              {
                id: '550e8400-e29b-41d4-a716-446655440003',
                action: 'SUBMITTED',
                fromStatus: 'DRAFT',
                toStatus: 'SUBMITTED',
                note: null,
                timestamp: '2026-06-20T10:15:00.000Z',
                timeLabel: '10:15 AM',
                actor: {
                  id: '550e8400-e29b-41d4-a716-446655440004',
                  name: 'Sales User',
                  role: 'SALES',
                },
                metadata: null,
                billingRequest: {
                  id: '550e8400-e29b-41d4-a716-446655440005',
                  number: 41,
                  title: 'Consulting services',
                  status: 'APPROVED',
                },
              },
            ],
          },
        ],
      },
    },
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  async getDailyTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: number,
  ): Promise<DailyTimelineResponse[]> {
    return this.service.getDailyTimeline(user, days);
  }
}
