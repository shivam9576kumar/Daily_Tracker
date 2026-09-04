import type { ProgressStats } from '../../types';
import './progress.css';

export default function StatsCards({ stats }: { stats: ProgressStats }) {
  const atRisk = stats.currentStreak > 0 && !stats.activeToday;

  return (
    <div className="progress-stats">
      <div className="progress-stat">
        <div className="progress-stat__label">Problems Solved</div>
        <div className={`progress-stat__value ${stats.totalSolved === 0 ? 'is-zero' : ''}`}>
          {stats.totalSolved}
        </div>
        <div className="progress-stat__detail">
          {stats.revisionsDone} revisions done · {stats.pendingRevisions} upcoming
        </div>
      </div>

      <div className="progress-stat">
        <div className="progress-stat__label">🔥 Current Streak</div>
        <div className={`progress-stat__value ${stats.currentStreak === 0 ? 'is-zero' : ''}`}>
          {stats.currentStreak}
        </div>
        <div className={`progress-stat__detail ${atRisk ? 'warn' : stats.activeToday ? 'ok' : ''}`}>
          {atRisk ? 'Solve one today to keep it' : stats.activeToday ? 'Active today' : 'Solve one to start'}
        </div>
      </div>

      <div className="progress-stat">
        <div className="progress-stat__label">Best Streak</div>
        <div className={`progress-stat__value ${stats.bestStreak === 0 ? 'is-zero' : ''}`}>
          {stats.bestStreak}
        </div>
        <div className="progress-stat__detail">days in a row</div>
      </div>

      <div className="progress-stat">
        <div className="progress-stat__label">Active Days</div>
        <div className={`progress-stat__value ${stats.activeDays === 0 ? 'is-zero' : ''}`}>
          {stats.activeDays}
        </div>
        <div className="progress-stat__detail">all time · 🪙 {stats.coins} coins</div>
      </div>
    </div>
  );
}
