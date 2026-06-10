import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  BillingRequestStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { toCents } from '../../common/utils/money';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  GenerateInvoiceJobData,
  INVOICE_JOBS,
  INVOICE_QUEUE,
} from '../queue/queue.constants';
import { CreateBillingRequestDto } from './dto/create-billing-request.dto';
import { UpdateBillingRequestDto } from './dto/update-billing-request.dto';
import { QueryBillingRequestsDto } from './dto/query-billing-requests.dto';
import { BillingRequestsRepository } from './billing-requests.repository';
import { toBillingRequestResponse } from './billing-request.mapper';
import {
  isEditable,
  WORKFLOW_ACTIONS,
  WorkflowActionName,
} from './workflow';

/** Maps a workflow action to the audit action it records. */
const ACTION_TO_AUDIT: Record<WorkflowActionName, AuditAction> = {
  submit: AuditAction.SUBMITTED,
  approve: AuditAction.APPROVED,
  reject: AuditAction.REJECTED,
  resubmit: AuditAction.RESUBMITTED,
};

@Injectable()
export class BillingRequestsService {
  private readonly logger = new Logger(BillingRequestsService.name);

  constructor(
    private readonly repository: BillingRequestsRepository,
    private readonly auditService: AuditService,
    @InjectQueue(INVOICE_QUEUE) private readonly invoiceQueue: Queue,
  ) {}

  async create(dto: CreateBillingRequestDto, user: AuthenticatedUser) {
    const created = await this.repository.transaction(async (tx) => {
      const request = await this.repository.create(
        {
          title: dto.title,
          customerName: dto.customerName,
          amountCents: toCents(dto.amount),
          currency: dto.currency ?? 'USD',
          description: dto.description,
          status: BillingRequestStatus.DRAFT,
          createdBy: { connect: { id: user.userId } },
        },
        tx,
      );
      await this.auditService.record(
        {
          billingRequestId: request.id,
          action: AuditAction.CREATED,
          actorId: user.userId,
          toStatus: request.status,
          note: 'Billing request created',
        },
        tx,
      );
      return request;
    });
    return toBillingRequestResponse(created);
  }

  async findAll(query: QueryBillingRequestsDto, user: AuthenticatedUser) {
    const where: Prisma.BillingRequestWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    // Sales users only ever see their own requests; reviewers/managers see all.
    if (user.role === Role.SALES || query.mine) {
      where.createdById = user.userId;
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.repository.findManyWithCount(
      where,
      page,
      pageSize,
    );

    return {
      data: items.map(toBillingRequestResponse),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const request = await this.getOrThrow(id);
    this.assertCanView(request.createdById, user);
    return toBillingRequestResponse(request);
  }

  async update(id: string, dto: UpdateBillingRequestDto, user: AuthenticatedUser) {
    const request = await this.getOrThrow(id);
    this.assertOwnership(request.createdById, user);

    if (!isEditable(request.status)) {
      throw new ConflictException(
        `Only DRAFT requests can be edited (current status: ${request.status})`,
      );
    }

    const data: Prisma.BillingRequestUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.amount !== undefined && { amountCents: toCents(dto.amount) }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.description !== undefined && { description: dto.description }),
    };

    const updated = await this.repository.transaction(async (tx) => {
      const result = await this.repository.update(id, data, tx);
      await this.auditService.record(
        {
          billingRequestId: id,
          action: AuditAction.UPDATED,
          actorId: user.userId,
          note: 'Draft details updated',
          metadata: { changedFields: Object.keys(data) },
        },
        tx,
      );
      return result;
    });
    return toBillingRequestResponse(updated);
  }

  submit(id: string, user: AuthenticatedUser) {
    return this.performAction('submit', id, user);
  }

  async approve(id: string, user: AuthenticatedUser) {
    const result = await this.performAction('approve', id, user, {
      review: true,
    });
    // Invoice generation runs asynchronously so the approval response is fast
    // and the heavier work (invoice + notification) is retried on failure.
    await this.invoiceQueue.add(INVOICE_JOBS.GENERATE, {
      billingRequestId: id,
      approvedByUserId: user.userId,
    } satisfies GenerateInvoiceJobData);
    this.logger.log(`Enqueued invoice generation for request ${id}`);
    return result;
  }

  reject(id: string, reason: string, user: AuthenticatedUser) {
    return this.performAction('reject', id, user, { review: true, reason });
  }

  resubmit(id: string, user: AuthenticatedUser) {
    return this.performAction('resubmit', id, user);
  }

  /**
   * Generic, guarded state transition. Validates the current status, the
   * actor's role and ownership, then applies the status change and its audit
   * entry atomically.
   */
  private async performAction(
    action: WorkflowActionName,
    id: string,
    user: AuthenticatedUser,
    options: { review?: boolean; reason?: string } = {},
  ) {
    const definition = WORKFLOW_ACTIONS[action];
    const request = await this.getOrThrow(id);

    if (request.status !== definition.from) {
      throw new ConflictException(
        `Cannot ${action} a request in status ${request.status}; expected ${definition.from}`,
      );
    }
    if (!definition.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(`Your role cannot ${action} this request`);
    }
    if (definition.requiresOwnership && request.createdById !== user.userId) {
      throw new ForbiddenException('You can only act on your own requests');
    }

    const data: Prisma.BillingRequestUpdateInput = { status: definition.to };
    if (options.review) {
      data.reviewedBy = { connect: { id: user.userId } };
      data.reviewedAt = new Date();
    }
    if (action === 'reject') {
      data.rejectionReason = options.reason;
    }
    if (action === 'resubmit') {
      // Clear prior review state so the request starts a clean cycle.
      data.rejectionReason = null;
      data.reviewedBy = { disconnect: true };
      data.reviewedAt = null;
    }

    const updated = await this.repository.transaction(async (tx) => {
      const result = await this.repository.update(id, data, tx);
      await this.auditService.record(
        {
          billingRequestId: id,
          action: ACTION_TO_AUDIT[action],
          actorId: user.userId,
          fromStatus: definition.from,
          toStatus: definition.to,
          note: options.reason ?? null,
        },
        tx,
      );
      return result;
    });
    return toBillingRequestResponse(updated);
  }

  /** Chronological audit trail for a request, gated by view permission. */
  async getAuditTrail(id: string, user: AuthenticatedUser) {
    const request = await this.getOrThrow(id);
    this.assertCanView(request.createdById, user);
    return this.auditService.listForRequest(id);
  }

  private async getOrThrow(id: string) {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new NotFoundException(`Billing request ${id} not found`);
    }
    return request;
  }

  private assertCanView(ownerId: string, user: AuthenticatedUser): void {
    if (user.role === Role.SALES && ownerId !== user.userId) {
      throw new ForbiddenException('You can only view your own requests');
    }
  }

  private assertOwnership(ownerId: string, user: AuthenticatedUser): void {
    if (ownerId !== user.userId) {
      throw new ForbiddenException('You can only modify your own requests');
    }
  }
}
