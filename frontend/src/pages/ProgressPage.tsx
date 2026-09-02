import { useEffect } from 'react';
import { useProgressStore } from '../store/progressStore';
import StatsCards from '../components/progress/StatsCards';
import Heatmap from '../components/progress/Heatmap';
import TopicProgress from '../components/progress/TopicProgress';
import DifficultyBreakdown from '../components/progress/DifficultyBreakdown';
import RecentActivity from '../components/progress/RecentActivity';
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
      <header className="progress-header">
        <h1 className="progress-title">📈 Progress</h1>
        <p className="progress-subtitle">
          Every green square is a day you showed up. Revisions count too.
        </p>
      </header>

      <StatsCards stats={data.stats} />
      <Heatmap data={data.heatmap} bestStreak={data.stats.bestStreak} />

      <div className="progress-columns">
        <TopicProgress
          data={data.topics}
          onScopeChange={(scope) => fetch({ scope, silent: true })}
        />
        <div>
          <DifficultyBreakdown
            difficulty={data.topics.difficulty}
            totals={data.topics.totals}
          />
          <RecentActivity items={data.activity} />
        </div>
      </div>
    </div>
  );
}
