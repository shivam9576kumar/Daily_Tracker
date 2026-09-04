import type { DifficultyBucket } from '../../types';
import CircularProgress from '../common/CircularProgress';
import './progress.css';

interface Props {
  difficulty: { easy: DifficultyBucket; medium: DifficultyBucket; hard: DifficultyBucket };
  totals: DifficultyBucket;
}

const difficultyConfig: Record<string, { color: string; label: string }> = {
  easy: { color: 'var(--easy-dot)', label: 'Easy' },
  medium: { color: 'var(--medium-dot)', label: 'Medium' },
  hard: { color: 'var(--hard-dot)', label: 'Hard' },
};

export default function DifficultyBreakdown({ difficulty, totals }: Props) {
  const rows: Array<['easy' | 'medium' | 'hard', DifficultyBucket]> = [
    ['easy', difficulty.easy],
    ['medium', difficulty.medium],
    ['hard', difficulty.hard],
  ];

  return (
    <section className="progress-card difficulty-card">
      <div className="progress-card__header">
        <h2 className="progress-card__heading">Difficulty</h2>
        <span className="difficulty-circular__total">
          {totals.solved} / {totals.total} solved
        </span>
      </div>

      <div className="difficulty-circular-grid">
        {rows.map(([key, d]) => {
          const cfg = difficultyConfig[key];
          const pct = d.total ? (d.solved / d.total) * 100 : 0;
          return (
            <div key={key} className="difficulty-circular-item">
              <CircularProgress
                percentage={pct}
                size={84}
                strokeWidth={7}
                color={cfg.color}
                trackColor="var(--border)"
              />
              <span className={`difficulty-circular__name ${key}`}>{cfg.label}</span>
              <span className="difficulty-circular__count">{d.solved} / {d.total}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
