import type { Vibe } from '../../types';
import './dashboard.css';

export default function VibeBanner({ vibe }: { vibe: Vibe }) {
  return (
    <div className={`vibe-banner vibe-${vibe.intensity}`}>
      <span className="vibe-emoji">{vibe.emoji}</span>
      <span>{vibe.message}</span>
    </div>
  );
}
