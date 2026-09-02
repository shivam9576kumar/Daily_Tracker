import './dashboard.css';

interface Props {
  totalQuestions: number;
  streak: number;
  backlog: number;
  expired: number;
  coins: number;
}

export default function StatusOverview({
  totalQuestions, streak, backlog, expired, coins,
}: Props) {
  return (
    <div className="status-overview" id="status-overview">
      <div className="status-card">
        <div className="status-card__label">Total Questions</div>
        <div className="status-card__value">{totalQuestions}</div>
      </div>
      <div className="status-card status-card--streak">
        <div className="status-card__label">🔥 Streak</div>
        <div className="status-card__value">{streak}</div>
      </div>
      <div className="status-card status-card--backlog">
        <div className="status-card__label">⚠️ Backlog</div>
        <div className="status-card__value">{backlog}</div>
      </div>
      <div className="status-card status-card--expired">
        <div className="status-card__label">💀 Expired</div>
        <div className="status-card__value">{expired}</div>
      </div>
      <div className="status-card status-card--coins">
        <div className="status-card__label">🪙 Coins</div>
        <div className="status-card__value">{coins}</div>
      </div>
    </div>
  );
}
