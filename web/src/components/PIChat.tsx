import { useState } from 'react';
import { usePIChat, useSendPIChatMessage } from '../api/hooks';
import { LoadingState, EmptyState } from './States';
import { formatTime } from '../lib/format';

interface PIChatProps {
  invoiceId: string;
}

export function PIChat({ invoiceId }: PIChatProps) {
  const chat = usePIChat(invoiceId);
  const sendMessage = useSendPIChatMessage();
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setError(null);
    try {
      await sendMessage.mutateAsync({ invoiceId, message: newMessage });
      setNewMessage('');
    } catch (err) {
      setError('Failed to send message. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (chat.isLoading) return <LoadingState label="Loading chat…" />;
  if (chat.isError) {
    return (
      <div className="state state--error">
        <strong>Failed to load chat history</strong>
      </div>
    );
  }
  if (!chat.data || !chat.data.chat.length) {
    return (
      <div className="pi-chat pi-chat--empty">
        <EmptyState title="No chat messages" hint="Start a conversation about this invoice" />
        <PIChatInput
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSend={handleSendMessage}
          onKeyPress={handleKeyPress}
          isSending={sendMessage.isPending}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="pi-chat">
      <div className="pi-chat__history">
        {chat.data.chat.map((group) => (
          <ChatDayGroup key={group.date} group={group} />
        ))}
      </div>
      <PIChatInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSend={handleSendMessage}
        onKeyPress={handleKeyPress}
        isSending={sendMessage.isPending}
        error={error}
      />
    </div>
  );
}

interface ChatDayGroupProps {
  group: {
    date: string;
    dateLabel: string;
    messages: Array<{
      id: string;
      message: string;
      senderName: string;
      role: string;
      createdAt: string;
    }>;
  };
}

function ChatDayGroup({ group }: ChatDayGroupProps) {
  return (
    <div className="pi-chat-day-group">
      <div className="pi-chat-day-header">
        <span className="pi-chat-day-label">{group.dateLabel}</span>
      </div>
      <div className="pi-chat-messages">
        {group.messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: {
    id: string;
    message: string;
    senderName: string;
    role: string;
    createdAt: string;
  };
}

function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="pi-chat-message">
      <div className="pi-chat-message__avatar">
        <div className="avatar avatar--manager">
          {message.senderName.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="pi-chat-message__body">
        <div className="pi-chat-message__header">
          <span className="pi-chat-message__author">{message.senderName}</span>
          <span className="pi-chat-message__role badge badge--role">{message.role}</span>
          <span className="pi-chat-message__time">{formatTime(message.createdAt)}</span>
        </div>
        <div className="pi-chat-message__content">{message.message}</div>
      </div>
    </div>
  );
}

interface PIChatInputProps {
  newMessage: string;
  setNewMessage: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  isSending: boolean;
  error: string | null;
}

function PIChatInput({
  newMessage,
  setNewMessage,
  onSend,
  onKeyPress,
  isSending,
  error,
}: PIChatInputProps) {
  return (
    <div className="pi-chat-input">
      <textarea
        className="pi-chat-input__field"
        placeholder="Type your message..."
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onKeyPress={onKeyPress}
        rows={3}
        disabled={isSending}
      />
      <div className="pi-chat-input__actions">
        <button
          className="btn btn--primary"
          onClick={onSend}
          disabled={!newMessage.trim() || isSending}
        >
          {isSending ? 'Sending…' : 'Send Message'}
        </button>
      </div>
      {error && <div className="form__error">{error}</div>}
    </div>
  );
}
