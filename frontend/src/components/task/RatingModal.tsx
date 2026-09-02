import { useState } from 'react';
import Modal from '../common/Modal';
import type { Rating } from '../../types';
import './task.css';

const OPTIONS: { key: Rating; emoji: string; label: string; desc: string }[] = [
  {
    key: 'easy',
    emoji: '😎',
    label: 'Easy',
    desc: 'Solved smoothly · Revisions on day +14, +28',
  },
  {
    key: 'medium',
    emoji: '🤔',
    label: 'Medium',
    desc: 'Took some thinking · Revisions on day +1, +3, +7, +14',
  },
  {
    key: 'hard',
    emoji: '😤',
    label: 'Hard',
    desc: 'Really struggled · Revisions on day +1, +3, +7, +14, +28',
  },
];

interface Props {
  open: boolean;
  taskTitle: string;
  currentRating?: Rating | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (rating: Rating) => void;
}

export default function RatingModal({
  open,
  taskTitle,
  currentRating,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [selected, setSelected] = useState<Rating | null>(null);

  const handlePick = (r: Rating) => {
    setSelected(r);
    onSubmit(r);
  };

  return (
    <Modal open={open} title="How hard was it?" onClose={onClose}>
      <p
        style={{
          color: '#9ca3af',
          fontSize: 13.5,
          marginTop: 0,
          marginBottom: 18,
        }}
      >
        <strong style={{ color: '#e5e7eb' }}>{taskTitle}</strong>
        <br />
        Your rating decides the spaced-repetition schedule.
      </p>

      <div className="rating-grid">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            disabled={submitting}
            className={`rating-btn ${o.key} ${
              selected === o.key || currentRating === o.key ? 'selected' : ''
            }`}
            onClick={() => handlePick(o.key)}
          >
            <span className="rating-emoji">{o.emoji}</span>
            <span className="rating-text">
              <div className="rating-label">{o.label}</div>
              <div className="rating-desc">{o.desc}</div>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
