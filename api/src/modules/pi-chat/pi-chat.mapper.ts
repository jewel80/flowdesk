import { ChatMessageWithSender, ChatMessageResponse, ChatDayGroup, PIChatResponse } from './pi-chat.types';

function toChatMessageResponse(message: ChatMessageWithSender): ChatMessageResponse {
  return {
    id: message.id,
    message: message.message,
    senderName: message.sentBy.name,
    role: message.sentBy.role,
    createdAt: message.createdAt.toISOString(),
  };
}

function groupMessagesByDate(messages: ChatMessageWithSender[]): ChatDayGroup[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const groups = new Map<string, ChatMessageResponse[]>();
  const sorted = [...messages].sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const message of sorted) {
    const msgDate = new Date(message.createdAt);
    msgDate.setHours(0, 0, 0, 0);

    let dateKey: string;
    let dateLabel: string;

    if (msgDate.getTime() === today.getTime()) {
      dateKey = 'today';
      dateLabel = 'Today';
    } else if (msgDate.getTime() === yesterday.getTime()) {
      dateKey = 'yesterday';
      dateLabel = 'Yesterday';
    } else {
      dateKey = msgDate.toISOString().split('T')[0];
      dateLabel = msgDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(toChatMessageResponse(message));
  }

  return Array.from(groups.entries()).map(([date, messages]) => ({
    date,
    dateLabel: date === 'today' ? 'Today' : date === 'yesterday' ? 'Yesterday' :
      new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    messages,
  }));
}

export { toChatMessageResponse, groupMessagesByDate, type PIChatResponse };
