import type { Vibe } from '../../types';
import './dashboard.css';

export default function VibeBanner({ vibe }: { vibe: Vibe }) {
  return (
    <section className="vibe-card" role="status" aria-live="polite">
      <span className="vibe-card__emoji" aria-hidden="true">{vibe.emoji}</span>
      <div>
        <p className="vibe-card__msg">{vibe.message}</p>
      </div>
    </section>
  );
}
