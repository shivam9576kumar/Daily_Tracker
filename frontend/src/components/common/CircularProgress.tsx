import './circular-progress.css';

interface Props {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  className?: string;
}

export default function CircularProgress({
  percentage,
  size = 64,
  strokeWidth = 6,
  color = 'var(--brand)',
  trackColor = 'var(--border)',
  className = '',
}: Props) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`circular-progress ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        className="circular-progress__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="circular-progress__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={trackColor}
          fill="none"
        />
        <circle
          className="circular-progress__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`circular-progress__value ${clamped === 0 ? 'is-zero' : ''}`}>
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
