import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/planStore';
import Roadmap from '../components/roadmap/Roadmap';
import PlanStats from '../components/roadmap/PlanStats';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import '../components/roadmap/roadmap.css';

export default function RoadmapPage() {
  const { data, loading, error, fetchActive } = usePlanStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  if (loading) {
    return (
      <div className="roadmap-page">
        <Spinner large />
      </div>
    );
  }

  if (error) {
    return (
      <div className="roadmap-page">
        <div className="empty-roadmap">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ {error}</div>
          <Button onClick={() => fetchActive()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data || !data.plan) {
    return (
      <div className="roadmap-page">
        <div className="roadmap-header">
          <div>
            <h1 className="roadmap-title">📖 Study Roadmap</h1>
            <p className="roadmap-subtitle">Your weekly journey towards DSA mastery with balanced daily loads.</p>
          </div>
        </div>
        <div className="empty-roadmap">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>🚀 No Active Study Plan</div>
          <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
            You don't have an active study roadmap yet. Create one with AI to get a customized, balanced schedule.
          </div>
          <Button onClick={() => navigate('/generate-plan')}>✨ Generate Study Plan</Button>
        </div>
      </div>
    );
  }

  const { plan, tasks } = data;

  return (
    <div className="roadmap-page">
      <div className="roadmap-header">
        <div>
          <h1 className="roadmap-title">📖 Study Roadmap</h1>
          <p className="roadmap-subtitle">
            {plan.name} • {tasks.length} questions • Weighted balanced schedule
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/generate-plan')}>
          + New Plan
        </Button>
      </div>

      <PlanStats plan={plan} tasks={tasks} />
      <Roadmap tasks={tasks} startDate={new Date(plan.startDate)} />
    </div>
  );
}
