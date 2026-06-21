import { Prisma } from '@prisma/client';

export type ChatMessageWithSender = Prisma.ChatMessageGetPayload<{
  include: {
    sentBy: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
  };
}>;

export interface ChatMessageResponse {
  id: string;
  message: string;
  senderName: string;
  role: string;
  createdAt: string;
}

export interface ChatDayGroup {
  date: string;
  dateLabel: string;
  messages: ChatMessageResponse[];
}

export interface PIChatResponse {
  piId: string;
  chat: ChatDayGroup[];
}
