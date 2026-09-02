import type { StatusOverview as SO } from '../../types';
import './dashboard.css';

const CARDS = [
  { key: 'totalQuestions', label: 'Total Questions', icon: '', cls: 'sc-total' },
  { key: 'streak', label: 'Streak', icon: '🔥', cls: 'sc-streak' },
  { key: 'backlog', label: 'Backlog', icon: '⚠️', cls: 'sc-backlog' },
  { key: 'expired', label: 'Expired', icon: '💀', cls: 'sc-expired' },
  { key: 'coins', label: 'Coins', icon: '🪙', cls: 'sc-coins' },
] as const;

export default function StatusOverview({ data }: { data: SO }) {
  return (
    <div className="status-overview">
      {CARDS.map((c) => (
        <div key={c.key} className={`status-card ${c.cls}`}>
          <div className="status-card-label">
            {c.icon && <span>{c.icon}</span>}
            {c.label}
          </div>
          <div className="status-card-value">{data[c.key]}</div>
          {c.key === 'streak' && data.streak > 0 && data.streakActiveToday === false && (
            <div style={{ fontSize: 11, color: '#fcd34d', marginTop: 6 }}>
              Solve one today to keep it
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
