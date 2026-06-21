import { type DailyTimelineResponse, type TimelineEntry } from '../api/types';
import { LoadingState, EmptyState } from './States';

interface DashboardTimelineProps {
  groups: DailyTimelineResponse;
  isLoading?: boolean;
}

export function DashboardTimeline({ groups, isLoading }: DashboardTimelineProps) {
  if (isLoading) return <LoadingState label="Loading timeline…" />;
  if (!groups?.length) return <EmptyState title="No activity in the selected time period" />;

  return (
    <div className="dashboard-timeline">
      {groups.map((group, groupIdx) => (
        <div key={group.date} className="timeline-day-group">
          {groupIdx > 0 && <div className="timeline-divider" />}
          <div className="timeline-day-header">
            <span className="timeline-day-label">{group.dateLabel}</span>
          </div>
          <div className="timeline-entries">
            {group.entries.map((entry) => (
              <TimelineEntry key={entry.id} entry={entry as TimelineEntry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TimelineEntryProps {
  entry: TimelineEntry;
}

function TimelineEntry({ entry }: TimelineEntryProps) {
  const isSystem = !entry.actor;

  return (
    <div className={`timeline-entry ${isSystem ? 'timeline-entry--system' : ''}`}>
      <div className="timeline-entry__avatar">
        {isSystem ? (
          <div className="avatar avatar--system">⚙️</div>
        ) : (
          <div className="avatar">{entry.actor!.name.charAt(0).toUpperCase()}</div>
        )}
      </div>
      <div className="timeline-entry__body">
        <div className="timeline-entry__header">
          <span className="timeline-entry__author">
            {isSystem ? 'System' : entry.actor!.name}
          </span>
          <span className="timeline-entry__role">
            {!isSystem && `(${entry.actor!.role.toLowerCase()})`}
          </span>
          <span className="timeline-entry__time">{entry.timeLabel}</span>
        </div>
        <div className="timeline-entry__content">
          <div className="timeline-entry__action">
            {humaniseAction(entry.action)}
            {entry.fromStatus && entry.toStatus && (
              <StatusChangeBadge from={entry.fromStatus} to={entry.toStatus} />
            )}
          </div>
          {entry.note && (
            <div className="timeline-entry__note">{entry.note}</div>
          )}
          <div className="timeline-entry__request">
            <span className="timeline-entry__request-number">
              #{entry.billingRequest.number}
            </span>
            <span className="timeline-entry__request-title">
              {entry.billingRequest.title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function humaniseAction(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1).toLowerCase().replace('_', ' ');
}

interface StatusChangeBadgeProps {
  from: string | null;
  to: string | null;
}

function StatusChangeBadge({ from, to }: StatusChangeBadgeProps) {
  return (
    <div className="status-change">
      {from && (
        <span className="status-badge status-badge--from">{humaniseAction(from)}</span>
      )}
      <span className="status-arrow">→</span>
      {to && <span className="status-badge status-badge--to">{humaniseAction(to)}</span>}
    </div>
  );
}
