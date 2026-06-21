import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { MetricsService } from './metrics.service';

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
}
