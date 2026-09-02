import type { ProgressStats } from '../../types';
import './progress.css';

export default function StatsCards({ stats }: { stats: ProgressStats }) {
  const atRisk = stats.currentStreak > 0 && !stats.activeToday;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Problems solved</div>
        <div className="stat-value">{stats.totalSolved}</div>
        <div className="stat-hint">
          {stats.revisionsDone} revisions done · {stats.pendingRevisions} upcoming
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">🔥 Current streak</div>
        <div className="stat-value">{stats.currentStreak}</div>
        <div className={`stat-hint ${atRisk ? 'warn' : stats.activeToday ? 'ok' : ''}`}>
          {atRisk ? 'Solve one today to keep it' : stats.activeToday ? 'Active today' : 'Solve one to start'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Best streak</div>
        <div className="stat-value">{stats.bestStreak}</div>
        <div className="stat-hint">days in a row</div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Active days</div>
        <div className="stat-value">{stats.activeDays}</div>
        <div className="stat-hint">all time · 🪙 {stats.coins} coins</div>
      </div>
    </div>
  );
}
