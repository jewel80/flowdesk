import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
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
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PIChatService } from './pi-chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@ApiTags('pi-chat')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class PIChatController {
  constructor(private readonly service: PIChatService) {}

  @Get(':id/pi-chat')
  @Roles(Role.MANAGER)
  @ApiOperation({
    summary: 'Get PI chat history',
    description: 'Returns all chat messages for a specific invoice, grouped by date. Only MANAGER role can access PI chat.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chat history retrieved successfully',
    schema: {
      example: {
        piId: '550e8400-e29b-41d4-a716-446655440000',
        chat: [
          {
            date: 'today',
            dateLabel: 'Today',
            messages: [
              {
                id: 'msg-id-1',
                message: 'PI reviewed successfully',
                senderName: 'Manager User',
                role: 'MANAGER',
                createdAt: '2026-06-21T16:00:00.000Z'
              }
            ]
          }
        ]
      }
    }
  })
  @ApiForbiddenResponse({ description: 'User does not have MANAGER role' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  getChatHistory(
    @Param('id') invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getChatHistory(invoiceId, user);
  }

  @Post(':id/pi-chat')
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a PI chat message',
    description: 'Sends a new chat message for a specific invoice. Only MANAGER role can send messages.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message sent successfully',
    schema: {
      example: {
        piId: '550e8400-e29b-41d4-a716-446655440000',
        chat: [
          {
            date: 'today',
            dateLabel: 'Today',
            messages: [
              {
                id: 'new-msg-id',
                message: 'PI approved for payment',
                senderName: 'Manager User',
                role: 'MANAGER',
                createdAt: '2026-06-21T17:30:00.000Z'
              }
            ]
          }
        ]
      }
    }
  })
  @ApiForbiddenResponse({ description: 'User does not have MANAGER role' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  @ApiBadRequestResponse({ description: 'Invalid message content' })
  sendMessage(
    @Param('id') invoiceId: string,
    @Body() dto: SendChatMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.sendMessage(invoiceId, dto.message, user);
  }
}
