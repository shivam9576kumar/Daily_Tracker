import type { ActivityItem } from '../../types';
import { timeAgo } from '../../utils/time';
import './progress.css';

const DOT: Record<string, string> = {
  easy: '#22c55e',
  medium: '#fbbf24',
  hard: '#ef4444',
};

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <section className="pcard" style={{ marginTop: 18 }}>
      <h3 className="pcard-title">Recent activity</h3>
      {items.length === 0 ? (
        <div className="progress-empty">Nothing yet. Your first solve shows up here.</div>
      ) : (
        items.map((a) => (
          <div className="activity-item" key={a.id}>
            <span
              className="activity-dot"
              style={{ background: DOT[a.difficulty ?? ''] || '#6b7280' }}
            />
            <span className="activity-title">
              {a.title}
              {a.taskType === 'revision' && (
                <span style={{ color: '#d8b4fe', marginLeft: 6, fontSize: 11 }}>
                  Rev #{a.revisionNumber}
                </span>
              )}
            </span>
            <span className="activity-time">{timeAgo(a.completedAt)}</span>
          </div>
        ))
      )}
    </section>
  );
}
