import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PIChatRepository } from './pi-chat.repository';
import { groupMessagesByDate, PIChatResponse } from './pi-chat.mapper';

@Injectable()
export class PIChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PIChatRepository,
  ) {}

  async getChatHistory(invoiceId: string, user: AuthenticatedUser): Promise<PIChatResponse> {
    const invoice = await this.repository.validateInvoiceAccess(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (user.role !== Role.MANAGER) {
      throw new ForbiddenException('Only managers can access PI chat');
    }

    const messages = await this.repository.findByInvoiceId(invoiceId);
    const chat = groupMessagesByDate(messages);

    return {
      piId: invoiceId,
      chat,
    };
  }

  async sendMessage(
    invoiceId: string,
    message: string,
    user: AuthenticatedUser,
  ): Promise<PIChatResponse> {
    return this.prisma.primary.$transaction(async (tx) => {
      if (user.role !== Role.MANAGER) {
        throw new ForbiddenException('Only managers can send PI chat messages');
      }

      const invoice = await this.repository.validateInvoiceAccess(invoiceId, tx);
      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      await this.repository.create(
        {
          message,
          invoice: { connect: { id: invoiceId } },
          sentBy: { connect: { id: user.userId } },
        },
        tx,
      );

      const messages = await this.repository.findByInvoiceId(invoiceId);
      return {
        piId: invoiceId,
        chat: groupMessagesByDate(messages),
      };
    });
  }
}
