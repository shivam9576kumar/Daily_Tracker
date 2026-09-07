import type { StatusOverview as SO } from '../../types';
import './dashboard.css';

type Kind = 'total' | 'streak' | 'backlog' | 'expired' | 'coins';

const CARDS: { kind: Kind; key: keyof SO; label: string; icon?: string }[] = [
  { kind: 'total', key: 'totalQuestions', label: 'Total Questions' },
  { kind: 'streak', key: 'streak', label: 'Streak', icon: '🔥' },
  { kind: 'backlog', key: 'backlog', label: 'Backlog', icon: '⚠️' },
  { kind: 'expired', key: 'expired', label: 'Expired', icon: '💀' },
  { kind: 'coins', key: 'coins', label: 'Coins', icon: '🪙' },
];

export default function StatusOverview({ data }: { data: SO }) {
  return (
    <div className="stats-grid">
      {CARDS.map((c) => {
        const val = Number(data[c.key]) || 0;
        const isActive = val > 0;
        return (
          <div key={c.kind} className={`card stat-card${isActive ? ' is-active' : ''}`} data-kind={c.kind}>
            <div className="stat-card__label t-label">
              {c.icon && <span className="stat-card__icon" aria-hidden="true">{c.icon}</span>}
              <span>{c.label}</span>
            </div>
            <div className="stat-card__value t-stat">{val}</div>
            {c.kind === 'streak' && val > 0 && data.streakActiveToday === false && (
              <div className="t-meta" style={{ color: 'var(--warning)', marginTop: 4 }}>
                Solve 1 today to keep it
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
