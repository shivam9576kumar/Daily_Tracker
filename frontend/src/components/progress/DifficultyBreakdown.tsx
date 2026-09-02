import type { DifficultyBucket } from '../../types';
import './progress.css';

interface Props {
  difficulty: { easy: DifficultyBucket; medium: DifficultyBucket; hard: DifficultyBucket };
  totals: DifficultyBucket;
}

export default function DifficultyBreakdown({ difficulty, totals }: Props) {
  const rows: Array<['easy' | 'medium' | 'hard', DifficultyBucket]> = [
    ['easy', difficulty.easy],
    ['medium', difficulty.medium],
    ['hard', difficulty.hard],
  ];

  return (
    <section className="pcard">
      <div className="pcard-head">
        <h3 className="pcard-title">Difficulty</h3>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {totals.solved}/{totals.total} solved
        </span>
      </div>
      {rows.map(([name, b]) => {
        const pct = b.total ? Math.round((b.solved / b.total) * 100) : 0;
        return (
          <div className="diff-row" key={name}>
            <span className={`diff-name ${name}`}>{name}</span>
            <div className="diff-bar">
              <div className={`diff-fill ${name}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="diff-count">
              {b.solved}/{b.total}
            </span>
          </div>
        );
      })}
    </section>
  );
}
