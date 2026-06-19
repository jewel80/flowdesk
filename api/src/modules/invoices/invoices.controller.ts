import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) { }

  @Get()
  @ApiOperation({
    summary: 'List invoices',
    description: 'Returns a list of all invoices. Sales users only see invoices for their own requests. Accounts and Manager roles see all invoices.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            number: 'INV-2026-0001',
            status: 'ISSUED',
            amountCents: 150000,
            currency: 'USD',
            dueDate: '2026-07-19T00:00:00.000Z',
            paidAt: null,
            billingRequest: {
              id: 'request-id',
              number: 'BR-2026-0001',
              title: 'Consulting services',
              customerName: 'Acme Corporation'
            },
            createdAt: '2026-06-19T12:00:00.000Z'
          }
        ]
      }
    }
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an invoice by ID',
    description: 'Returns detailed information about a specific invoice. Sales users can only view invoices for their own requests.'
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice retrieved successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        number: 'INV-2026-0001',
        status: 'ISSUED',
        amountCents: 150000,
        currency: 'USD',
        dueDate: '2026-07-19T00:00:00.000Z',
        paidAt: null,
        billingRequest: {
          id: 'request-id',
          number: 'BR-2026-0001',
          title: 'Consulting services',
          customerName: 'Acme Corporation'
        },
        createdAt: '2026-06-19T12:00:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  @ApiForbiddenResponse({ description: 'User does not have permission to view this invoice' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Post(':id/mark-paid')
  @Roles(Role.ACCOUNTS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark an invoice as paid',
    description: 'Marks an ISSUED invoice as PAID. Only ACCOUNTS role can mark invoices as paid.'
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice marked as paid successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        number: 'INV-2026-0001',
        status: 'PAID',
        amountCents: 150000,
        currency: 'USD',
        dueDate: '2026-07-19T00:00:00.000Z',
        paidAt: '2026-06-25T14:30:00.000Z'
      }
    }
  })
  @ApiForbiddenResponse({ description: 'User does not have ACCOUNTS role' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  @ApiConflictResponse({ description: 'Cannot mark invoice as paid in current status' })
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markPaid(id, user);
  }
}
