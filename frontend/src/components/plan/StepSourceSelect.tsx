import type { PlanSource } from '../../types';
import './plan.css';

interface Props {
  source: PlanSource;
  onChange: (source: PlanSource) => void;
}

const SOURCES = [
  {
    id: 'neetcode150' as PlanSource,
    name: 'NeetCode 150 Sample',
    icon: '🚀',
    description: '20 essential curated DSA patterns (Arrays, Two Pointers, Trees, Sliding Window, DP, etc.)',
    meta: '20 problems',
  },
  {
    id: 'coderarmy' as PlanSource,
    name: 'Coder Army Sheet',
    icon: '⚔️',
    description: '715 comprehensive DSA problems across 17 topics (Arrays, DP, Graphs, Trees, Heaps, Backtracking, etc.)',
    meta: '715 problems · 17 topics',
  },
];

export default function StepSourceSelect({ source, onChange }: Props) {
  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 1 of 5</div>
      <h2 className="step-card__heading">Select Question Source</h2>
      <p className="step-card__hint">
        Choose the curated question sheet or bank to generate your plan from.
      </p>

      <div className="source-grid">
        {SOURCES.map((s) => {
          const isSelected = source === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`option-card${isSelected ? ' is-selected' : ''}`}
              onClick={() => onChange(s.id)}
              aria-pressed={isSelected}
            >
              <span className="option-card__check" aria-hidden="true">✓</span>
              <span className="option-card__icon" aria-hidden="true">{s.icon}</span>
              <span className="option-card__title">{s.name}</span>
              <span className="option-card__desc">{s.description}</span>
              <span className="option-card__meta">{s.meta}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
