import type { StatusOverview as SO } from '../../types';
import './dashboard.css';

type Kind = 'total' | 'streak' | 'backlog' | 'expired' | 'coins';

const CARDS: { kind: Kind; key: keyof SO; label: string }[] = [
  { kind: 'total', key: 'totalQuestions', label: 'Solved' },
  { kind: 'streak', key: 'streak', label: 'Streak' },
  { kind: 'backlog', key: 'backlog', label: 'Backlog' },
  { kind: 'expired', key: 'expired', label: 'Expired' },
  { kind: 'coins', key: 'coins', label: 'Coins' },
];

export default function StatusOverview({ data }: { data: SO }) {
  return (
    <div className="stats-grid">
      {CARDS.map((c) => {
        const val = Number(data[c.key]) || 0;
        const isActive = val > 0;
        return (
          <div key={c.kind} className={`card stat-card${isActive ? ' is-active' : ''}`} data-kind={c.kind}>
            <div className="stat-card__label">
              <span>{c.label}</span>
            </div>
            <div className="stat-card__value">{val}</div>
            {c.kind === 'streak' && val > 0 && data.streakActiveToday === false && (
              <div className="stat-card__sub">
                Solve 1 today to keep it
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
