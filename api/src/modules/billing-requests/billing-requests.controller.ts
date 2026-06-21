import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BillingRequestsService } from './billing-requests.service';
import { CreateBillingRequestDto } from './dto/create-billing-request.dto';
import { UpdateBillingRequestDto } from './dto/update-billing-request.dto';
import { RejectBillingRequestDto } from './dto/reject-billing-request.dto';
import { QueryBillingRequestsDto } from './dto/query-billing-requests.dto';

/**
 * HTTP boundary only: parse/route the request, delegate to the service.
 * No business logic lives here. Authorization is declared via @Roles; the
 * service additionally enforces ownership and workflow rules.
 */
@ApiTags('billing-requests')
@ApiBearerAuth('JWT-auth')
@Controller('billing-requests')
export class BillingRequestsController {
  constructor(private readonly service: BillingRequestsService) { }

  @Post()
  @Roles(Role.SALES)
  @ApiOperation({
    summary: 'Create a new billing request',
    description: 'Creates a new draft billing request. Only users with SALES role can create requests.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Billing request created successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        number: 'BR-2026-0001',
        status: 'DRAFT',
        title: 'Consulting services',
        customerName: 'Acme Corporation',
        amountCents: 150000,
        currency: 'USD',
        description: 'Monthly consulting services',
        createdAt: '2026-06-19T10:00:00.000Z',
        createdBy: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Sales User',
          email: 'sales@flowdesk.dev'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiForbiddenResponse({ description: 'User does not have SALES role' })
  create(
    @Body() dto: CreateBillingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List billing requests',
    description: 'Returns a paginated list of billing requests. Sales users only see their own requests. Accounts and Manager roles see all requests.'
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED'] })
  @ApiQuery({ name: 'mine', required: false, description: 'Filter to own requests (Sales auto-scoped)', type: Boolean })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page', type: Number, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Billing requests retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            number: 'BR-2026-0001',
            status: 'SUBMITTED',
            title: 'Consulting services',
            customerName: 'Acme Corporation',
            amountCents: 150000,
            currency: 'USD',
            createdAt: '2026-06-19T10:00:00.000Z',
            createdBy: { name: 'Sales User', email: 'sales@flowdesk.dev' }
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20
      }
    }
  })
  findAll(
    @Query() query: QueryBillingRequestsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a billing request by ID',
    description: 'Returns detailed information about a specific billing request. Sales users can only view their own requests.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Billing request retrieved successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        number: 'BR-2026-0001',
        status: 'SUBMITTED',
        title: 'Consulting services',
        customerName: 'Acme Corporation',
        amountCents: 150000,
        currency: 'USD',
        description: 'Monthly consulting services',
        rejectionReason: null,
        createdAt: '2026-06-19T10:00:00.000Z',
        createdBy: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Sales User',
          email: 'sales@flowdesk.dev'
        },
        reviewedBy: null
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiForbiddenResponse({ description: 'User does not have permission to view this request' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Get(':id/audit')
  @ApiOperation({
    summary: 'Get audit trail for a billing request',
    description: 'Returns the complete audit trail for a billing request, showing all state changes and actions.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit trail retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'audit-id-1',
            action: 'CREATED',
            fromStatus: null,
            toStatus: 'DRAFT',
            note: 'Request created',
            actor: { name: 'Sales User', email: 'sales@flowdesk.dev' },
            createdAt: '2026-06-19T10:00:00.000Z'
          },
          {
            id: 'audit-id-2',
            action: 'SUBMITTED',
            fromStatus: 'DRAFT',
            toStatus: 'SUBMITTED',
            note: 'Request submitted for approval',
            actor: { name: 'Sales User', email: 'sales@flowdesk.dev' },
            createdAt: '2026-06-19T11:00:00.000Z'
          }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiForbiddenResponse({ description: 'User does not have permission to view this request' })
  auditTrail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getAuditTrail(id, user);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get day-wise history for a billing request',
    description: 'Returns audit trail entries grouped by day with enhanced formatting for chat-like display. Groups are labeled as "Today", "Yesterday", or specific dates (e.g., "June 15, 2026").'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Day-wise history retrieved successfully',
    schema: {
      example: {
        data: [
          {
            date: 'today',
            dateLabel: 'Today',
            entries: [
              {
                id: 'audit-id-3',
                action: 'APPROVED',
                fromStatus: 'SUBMITTED',
                toStatus: 'APPROVED',
                note: null,
                timestamp: '2026-06-21T14:30:00.000Z',
                timeLabel: '2:30 PM',
                actor: {
                  id: 'user-id-1',
                  name: 'Accounts User',
                  role: 'ACCOUNTS',
                  email: null
                },
                metadata: null,
                statusChange: {
                  from: 'SUBMITTED',
                  to: 'APPROVED'
                }
              }
            ]
          },
          {
            date: 'yesterday',
            dateLabel: 'Yesterday',
            entries: [
              {
                id: 'audit-id-2',
                action: 'SUBMITTED',
                fromStatus: 'DRAFT',
                toStatus: 'SUBMITTED',
                note: 'Request submitted for approval',
                timestamp: '2026-06-20T10:15:00.000Z',
                timeLabel: '10:15 AM',
                actor: {
                  id: 'user-id-2',
                  name: 'Sales User',
                  role: 'SALES',
                  email: null
                },
                metadata: null,
                statusChange: {
                  from: 'DRAFT',
                  to: 'SUBMITTED'
                }
              }
            ]
          },
          {
            date: '2026-06-15',
            dateLabel: 'June 15, 2026',
            entries: [
              {
                id: 'audit-id-1',
                action: 'CREATED',
                fromStatus: null,
                toStatus: 'DRAFT',
                note: 'Request created',
                timestamp: '2026-06-15T09:00:00.000Z',
                timeLabel: '9:00 AM',
                actor: {
                  id: 'user-id-2',
                  name: 'Sales User',
                  role: 'SALES',
                  email: null
                },
                metadata: null,
                statusChange: {
                  from: null,
                  to: 'DRAFT'
                }
              }
            ]
          }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiForbiddenResponse({ description: 'User does not have permission to view this request' })
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getHistory(id, user);
  }

  @Patch(':id')
  @Roles(Role.SALES)
  @ApiOperation({
    summary: 'Update a billing request',
    description: 'Updates an existing draft billing request. Only DRAFT requests owned by the creator can be updated.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Billing request updated successfully'
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiForbiddenResponse({ description: 'User does not have permission to update this request' })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiConflictResponse({ description: 'Cannot update request in current status' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBillingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(Role.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a billing request for approval',
    description: 'Transitions a DRAFT billing request to SUBMITTED status. Only the request owner can submit.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request submitted successfully'
  })
  @ApiForbiddenResponse({ description: 'User does not have permission to submit this request' })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiConflictResponse({ description: 'Cannot submit request in current status' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(Role.ACCOUNTS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a billing request',
    description: 'Approves a SUBMITTED billing request and generates an invoice asynchronously. Only ACCOUNTS role can approve.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request approved successfully and invoice generation initiated',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        number: 'BR-2026-0001',
        status: 'APPROVED',
        title: 'Consulting services',
        customerName: 'Acme Corporation',
        amountCents: 150000,
        currency: 'USD',
        reviewedBy: { name: 'Accounts User', email: 'accounts@flowdesk.dev' }
      }
    }
  })
  @ApiForbiddenResponse({ description: 'User does not have ACCOUNTS role' })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiConflictResponse({ description: 'Cannot approve request in current status' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user);
  }

  @Post(':id/reject')
  @Roles(Role.ACCOUNTS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a billing request',
    description: 'Rejects a SUBMITTED billing request with a mandatory reason. Only ACCOUNTS role can reject.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request rejected successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        number: 'BR-2026-0001',
        status: 'REJECTED',
        title: 'Consulting services',
        customerName: 'Acme Corporation',
        amountCents: 150000,
        currency: 'USD',
        rejectionReason: 'Incomplete customer information',
        reviewedBy: { name: 'Accounts User', email: 'accounts@flowdesk.dev' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Rejection reason is required' })
  @ApiForbiddenResponse({ description: 'User does not have ACCOUNTS role' })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiConflictResponse({ description: 'Cannot reject request in current status' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBillingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(id, dto.reason, user);
  }

  @Post(':id/resubmit')
  @Roles(Role.SALES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resubmit a rejected billing request',
    description: 'Transitions a REJECTED billing request back to DRAFT status so it can be edited and resubmitted. Only the request owner can resubmit.'
  })
  @ApiParam({ name: 'id', description: 'Billing request UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Request resubmitted successfully'
  })
  @ApiForbiddenResponse({ description: 'User does not have permission to resubmit this request' })
  @ApiNotFoundResponse({ description: 'Billing request not found' })
  @ApiConflictResponse({ description: 'Cannot resubmit request in current status' })
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resubmit(id, user);
  }
}
