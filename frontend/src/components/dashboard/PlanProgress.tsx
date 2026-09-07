export default function PlanProgress({
  planName,
  dayProgress,
}: {
  planName: string;
  dayProgress: number;
}) {
  return (
    <div className="plan-progress">
      <div className="plan-progress__label">
        <span>{planName}</span>
        <span className="mono">{Math.round(dayProgress)}%</span>
      </div>
      <div className="progress">
        <div
          className="progress__fill"
          style={{ width: `${Math.min(100, Math.max(0, dayProgress))}%` }}
        />
      </div>
    </div>
  );
}
