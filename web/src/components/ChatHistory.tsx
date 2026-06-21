import { HistoryDayGroup, HistoryEntry } from '../api/types';
import { humanise } from '../lib/format';
import { LoadingState, EmptyState } from './States';

interface ChatHistoryProps {
  groups: HistoryDayGroup[];
  isLoading?: boolean;
}

export function ChatHistory({ groups, isLoading }: ChatHistoryProps) {
  if (isLoading) return <LoadingState label="Loading history…" />;
  if (!groups?.length) return <EmptyState title="No history available" />;

  return (
    <div className="chat-history">
      {groups.map((group, groupIdx) => (
        <div key={group.date} className="chat-day-group">
          {groupIdx > 0 && <div className="chat-divider" />}
          <div className="chat-day-header">
            <span className="chat-day-label">{group.dateLabel}</span>
          </div>
          <div className="chat-entries">
            {group.entries.map((entry) => (
              <ChatEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChatEntryProps {
  entry: HistoryEntry;
}

function ChatEntry({ entry }: ChatEntryProps) {
  const isSystem = !entry.actor;
  const hasStatusChange = entry.fromStatus || entry.toStatus;

  return (
    <div className={`chat-entry ${isSystem ? 'chat-entry--system' : ''}`}>
      <div className="chat-entry__avatar">
        {isSystem ? (
          <div className="avatar avatar--system">⚙️</div>
        ) : (
          <div className="avatar">
            {entry.actor!.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="chat-entry__body">
        <div className="chat-entry__header">
          <span className="chat-entry__author">
            {isSystem ? 'System' : entry.actor!.name}
          </span>
          <span className="chat-entry__time">{entry.timeLabel}</span>
        </div>
        <div className="chat-entry__content">
          <div className="chat-entry__action">
            {humanise(entry.action)}
            {hasStatusChange && (
              <StatusChangeBadge from={entry.fromStatus} to={entry.toStatus} />
            )}
          </div>
          {entry.note && (
            <div className="chat-entry__note">{entry.note}</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatusChangeBadgeProps {
  from: string | null;
  to: string | null;
}

function StatusChangeBadge({ from, to }: StatusChangeBadgeProps) {
  return (
    <div className="status-change">
      {from && (
        <span className="status-badge status-badge--from">{humanise(from)}</span>
      )}
      <span className="status-arrow">→</span>
      {to && <span className="status-badge status-badge--to">{humanise(to)}</span>}
    </div>
  );
}
