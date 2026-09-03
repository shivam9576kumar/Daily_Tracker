import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/planStore';
import Roadmap from '../components/roadmap/Roadmap';
import PlanStats from '../components/roadmap/PlanStats';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { localKey } from '../utils/dateKeys';
import '../components/roadmap/roadmap.css';

export default function RoadmapPage() {
  const { data, loading, error, fetchActive } = usePlanStore();
  const navigate = useNavigate();

  // Always refetch on mount so unrating on the Dashboard is reflected immediately here.
  useEffect(() => { fetchActive(); }, [fetchActive]);

  if (loading && !data) {
    return <div className="roadmap-page"><Spinner large /></div>;
  }

  if (error && !data) {
    return (
      <div className="roadmap-page">
        <div className="empty-roadmap">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ {error}</div>
          <Button onClick={() => fetchActive()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { plan, tasks, revisions } = data;
  const originKey = localKey(new Date(data.origin));
  const upcoming = revisions.filter((r) => r.status !== 'completed').length;

  // ── State 1: nothing at all ──
  if (!plan && revisions.length === 0) {
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

  // ── State 2: no plan, but revisions exist (manual problems were rated) ──
  if (!plan) {
    return (
      <div className="roadmap-page">
        <div className="roadmap-header">
          <div>
            <h1 className="roadmap-title">🔁 Upcoming Revisions</h1>
            <p className="roadmap-subtitle">
              No active plan. These are spaced-repetition revisions from problems you've rated · {upcoming} upcoming
            </p>
          </div>
          <Button onClick={() => navigate('/generate-plan')}>✨ Generate Study Plan</Button>
        </div>
        <Roadmap tasks={[]} revisions={revisions} originKey={originKey} />
      </div>
    );
  }

  // ── State 3: active plan (+ all revisions) ──
  return (
    <div className="roadmap-page">
      <div className="roadmap-header">
        <div>
          <h1 className="roadmap-title">📖 Study Roadmap</h1>
          <p className="roadmap-subtitle">
            {plan.name} · {tasks.length} problems · {upcoming} revisions upcoming
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/generate-plan')}>+ New Plan</Button>
      </div>

      <PlanStats plan={plan} tasks={tasks} revisions={revisions} />
      <Roadmap tasks={tasks} revisions={revisions} originKey={originKey} />
    </div>
  );
}
