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
@Controller('billing-requests')
export class BillingRequestsController {
  constructor(private readonly service: BillingRequestsService) { }

  @Post()
  @Roles(Role.SALES)
  create(
    @Body() dto: CreateBillingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryBillingRequestsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Get(':id/audit')
  auditTrail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getAuditTrail(id, user);
  }

  @Patch(':id')
  @Roles(Role.SALES)
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
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(Role.ACCOUNTS)
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(id, user);
  }

  @Post(':id/reject')
  @Roles(Role.ACCOUNTS)
  @HttpCode(HttpStatus.OK)
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
  resubmit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resubmit(id, user);
  }
}
