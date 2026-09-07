import type { Vibe } from '../../types';
import './dashboard.css';

export default function VibeBanner({ vibe }: { vibe: Vibe }) {
  return (
    <section className="vibe-card" role="status" aria-live="polite">
      {vibe.emoji && <span className="vibe-card__emoji-text" aria-hidden="true">{vibe.emoji}</span>}
      <p className="vibe-card__msg">{vibe.message}</p>
    </section>
  );
}
