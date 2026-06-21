import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const CHAT_MESSAGE_INCLUDE = {
  sentBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ChatMessageInclude;

type Client = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class PIChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByInvoiceId(invoiceId: string) {
    return this.prisma.reader.chatMessage.findMany({
      where: { invoiceId },
      include: CHAT_MESSAGE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  create(data: Prisma.ChatMessageCreateInput, client: Client = this.prisma.primary) {
    return client.chatMessage.create({
      data,
      include: CHAT_MESSAGE_INCLUDE,
    });
  }

  validateInvoiceAccess(invoiceId: string, client: Client = this.prisma.reader) {
    return client.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
  }
}
