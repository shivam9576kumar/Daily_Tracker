import { useEffect } from 'react';
import { useProgressStore } from '../store/progressStore';
import StatsCards from '../components/progress/StatsCards';
import Heatmap from '../components/progress/Heatmap';
import TopicProgress from '../components/progress/TopicProgress';
import DifficultyBreakdown from '../components/progress/DifficultyBreakdown';
import ActivityLog from '../components/progress/ActivityLog';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import '../components/progress/progress.css';

export default function ProgressPage() {
  const { data, loading, error, fetch } = useProgressStore();

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading && !data) {
    return (
      <div className="progress-page">
        <Spinner large />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="progress-page">
        <div className="pcard progress-empty">
          <div style={{ marginBottom: 12 }}>⚠️ {error}</div>
          <Button onClick={() => fetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="progress-page">
      <header className="progress-page__header">
        <div className="progress-page__title-row">
          <span className="progress-page__icon" aria-hidden="true">📈</span>
          <h1 className="progress-page__title">Progress</h1>
        </div>
        <p className="progress-page__subtitle">
          Every green square is a day you showed up. Revisions count too.
        </p>
      </header>

      <StatsCards stats={data.stats} />
      <Heatmap data={data.heatmap} bestStreak={data.stats.bestStreak} />

      <div className="progress-analytics-grid">
        <TopicProgress
          data={data.topics}
          onScopeChange={(scope) => fetch({ scope, silent: true })}
        />
        <DifficultyBreakdown
          difficulty={data.topics.difficulty}
          totals={data.topics.totals}
        />
      </div>

      <section className="progress-card activity-card">
        <div className="progress-card__header">
          <h2 className="progress-card__heading">Recent Activity</h2>
        </div>

        <div className="activity-card__body">
          <ActivityLog activities={data.activity} />
        </div>
      </section>
    </div>
  );
}
