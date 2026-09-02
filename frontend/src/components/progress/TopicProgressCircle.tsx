import './progress.css';

const R = 26;
const C = 2 * Math.PI * R;

interface Props {
  topic: string;
  solved: number;
  total: number;
  percent: number;
}

function colorFor(p: number) {
  if (p >= 100) return '#22c55e';
  if (p >= 50) return '#8b5cf6';
  if (p > 0) return '#6366f1';
  return 'rgba(255,255,255,0.15)';
}

export default function TopicProgressCircle({ topic, solved, total, percent }: Props) {
  return (
    <div className="topic-ring" title={`${topic}: ${solved} of ${total}`}>
      <div className="topic-ring-wrap">
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={colorFor(percent)}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - percent / 100)}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="topic-ring-pct">{percent}%</div>
      </div>
      <div className="topic-name">{topic}</div>
      <div className="topic-count">
        {solved}/{total}
      </div>
    </div>
  );
}
