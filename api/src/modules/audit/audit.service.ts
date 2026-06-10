import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface RecordAuditInput {
  billingRequestId: string;
  action: AuditAction;
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes to the append-only audit trail. `record` accepts an optional Prisma
 * transaction client so an audit entry can be committed atomically with the
 * state change that produced it — an action and its audit row never diverge.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: RecordAuditInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        billingRequestId: input.billingRequestId,
        action: input.action,
        actorId: input.actorId ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        note: input.note ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  /** Full chronological history for a single request. */
  listForRequest(billingRequestId: string) {
    return this.prisma.auditLog.findMany({
      where: { billingRequestId },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, name: true, role: true } },
      },
    });
  }
}
