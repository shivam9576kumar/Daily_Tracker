import type { Rating } from '../../types';
import './task.css';

const OPTIONS: { key: Rating; emoji: string; label: string; title: string }[] = [
  { key: 'easy',   emoji: '😎', label: 'Easy',   title: 'Revise on day +14, +28' },
  { key: 'medium', emoji: '🤔', label: 'Medium', title: 'Revise on day +1, +3, +7, +14' },
  { key: 'hard',   emoji: '😤', label: 'Hard',   title: 'Revise on day +1, +3, +7, +14, +28' },
];

interface Props {
  value: Rating | null | undefined;
  size?: 'sm' | 'md';
  disabled?: boolean;
  onRate: (rating: Rating) => void;   // tapped a dim pill
  onUnrate: () => void;               // tapped the bright pill
}

/** Three toggle pills. Exactly one is bright when rated; tapping it again unrates. */
export default function RatingPills({ value, size = 'md', disabled, onRate, onUnrate }: Props) {
  return (
    <div className={`rating-pills rating-pills-${size}`} role="radiogroup" aria-label="Revision difficulty">
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            className={`rating-pill ${o.key}${active ? ' selected is-active' : ''}`}
            title={active ? `Rated ${o.label} — tap again to remove the revision plan` : o.title}
            onClick={() => (active ? onUnrate() : onRate(o.key))}
          >
            <span className="rating-pill-emoji">{o.emoji}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
