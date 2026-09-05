import type { ActivityItem } from '../../types';
import { timeAgo } from '../../utils/time';
import './progress.css';

interface Props {
  activities?: ActivityItem[];
  items?: ActivityItem[];
}

export default function ActivityLog({ activities, items }: Props) {
  const list = activities ?? items ?? [];

  if (list.length === 0) {
    return (
      <div className="activity-empty">
        <span className="activity-empty__icon" aria-hidden="true">🕓</span>
        <p className="activity-empty__title">No recent activity yet.</p>
        <p className="activity-empty__hint">
          Solve your first problem to start building history.
        </p>
      </div>
    );
  }

  return (
    <div className="activity-list">
      {list.map((item) => {
        const isRev = item.taskType === 'revision';
        const isPotd = item.taskType === 'potd';
        const diff = item.difficulty ? item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1) : '';
        const metaParts: string[] = [];
        if (isPotd) metaParts.push('POTD');
        if (item.topic) metaParts.push(item.topic);
        if (diff) metaParts.push(diff);
        if (isRev) metaParts.push(`Rev #${item.revisionNumber}`);

        return (
          <div className="activity-row" key={item.id}>
            <span className={`activity-row__icon ${isRev ? 'is-revision' : 'is-solved'}`} aria-hidden="true">
              {isRev ? '🔁' : '✓'}
            </span>
            <div className="activity-row__content">
              <span className="activity-row__title">{item.title}</span>
              <span className="activity-row__meta">{metaParts.join(' · ')}</span>
            </div>
            <span className="activity-row__time">{timeAgo(item.completedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
