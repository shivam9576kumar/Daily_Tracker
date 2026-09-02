interface Props {
  emoji: string;
  message: string;
  intensity: 'none' | 'low' | 'medium' | 'high';
}

export default function VibeBanner({ emoji, message, intensity }: Props) {
  return (
    <div className={`vibe-banner vibe-banner--${intensity}`} id="vibe-banner">
      <span className="vibe-emoji">{emoji}</span>
      <span className="vibe-text">{message}</span>
    </div>
  );
}
