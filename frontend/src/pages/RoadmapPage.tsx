import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/planStore';
import { useDashboardStore } from '../store/dashboardStore';
import Roadmap from '../components/roadmap/Roadmap';
import PlanStats from '../components/roadmap/PlanStats';
import DeletePlanModal from '../components/roadmap/DeletePlanModal';
import ArchivedPlansList from '../components/roadmap/ArchivedPlansList';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { localKey } from '../utils/dateKeys';
import { planApi } from '../services/planApi';
import { getErrorMessage } from '../services/api';
import { useUIStore } from '../store/uiStore';
import '../components/roadmap/roadmap.css';

export default function RoadmapPage() {
  const { data, archived, loading, error, fetchActive, fetchArchived } = usePlanStore();
  const dashboardFetch = useDashboardStore((s) => s.fetch);
  const toast = useUIStore((s) => s.toast);
  const navigate = useNavigate();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { fetchActive(); fetchArchived(); }, [fetchActive, fetchArchived]);

  const handleDeleteActive = () => {
    if (!data?.plan) return;
    setDeleteTargetId(data.plan.id);
    setDeleteOpen(true);
  };

  const handleDeleteArchived = (id: string) => {
    setDeleteTargetId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    setBusyId(deleteTargetId);
    try {
      await planApi.remove(deleteTargetId);
      toast('Plan deleted', 'info');
      setDeleteOpen(false);
      setDeleteTargetId(null);
      await Promise.all([fetchActive(), fetchArchived(), dashboardFetch(true)]);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }, [deleteTargetId, fetchActive, fetchArchived, dashboardFetch, toast]);

  const handleRestore = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await planApi.restore(id);
      toast('Plan restored as active', 'success');
      await Promise.all([fetchActive(), fetchArchived(), dashboardFetch(true)]);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  }, [fetchActive, fetchArchived, dashboardFetch, toast]);

  if (loading && !data) return <div className="roadmap-page"><Spinner large /></div>;

  if (error && !data) {
    return (
      <div className="roadmap-page">
        <section className="card roadmap-empty">
          <span className="roadmap-empty__icon" aria-hidden="true">⚠️</span>
          <h2 className="t-h2">Unable to load roadmap</h2>
          <p className="t-body roadmap-empty__hint">{error}</p>
          <Button onClick={() => fetchActive()}>Retry</Button>
        </section>
      </div>
    );
  }

  if (!data) return null;

  const { plan, tasks, revisions, origin } = data;
  const originKey = localKey(new Date(origin));
  const deleteTargetPlan = deleteTargetId === plan?.id ? plan : archived.find(p => p.id === deleteTargetId) ?? null;

  if (!plan && revisions.length === 0 && archived.length === 0) {
    return (
      <div className="roadmap-page">
        <section className="card roadmap-empty">
          <span className="roadmap-empty__icon" aria-hidden="true">🗺️</span>
          <h2 className="t-h2">No active plan</h2>
          <p className="t-body roadmap-empty__hint">
            Your schedule is cleared. Solved problems and already-scheduled revisions are kept.
          </p>
          <button type="button" className="btn-primary" onClick={() => navigate('/generate-plan')}>
            Generate Plan
          </button>
        </section>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="roadmap-page">
        <header className="roadmap-head">
          <div>
            <div className="roadmap-head__title">
              <span className="roadmap-head__icon" aria-hidden="true">🔁</span>
              <h1 className="t-h1">Upcoming Revisions</h1>
            </div>
            <p className="t-body roadmap-head__sub">
              No active plan. Your schedule is cleared. Solved problems and already-scheduled revisions are kept.
            </p>
          </div>
          <div className="roadmap-head__actions">
            <button type="button" className="btn-primary" onClick={() => navigate('/generate-plan')}>
              Generate Plan
            </button>
          </div>
        </header>

        {revisions.length > 0 && <Roadmap tasks={[]} revisions={revisions} originKey={originKey} />}
        <ArchivedPlansList plans={archived} busyId={busyId} onRestore={handleRestore} onDelete={handleDeleteArchived} />
        <DeletePlanModal
          open={deleteOpen}
          plan={deleteTargetPlan}
          tasks={[]}
          revisions={revisions}
          busy={!!busyId}
          onClose={() => { setDeleteOpen(false); setDeleteTargetId(null); }}
          onConfirm={confirmDelete}
        />
      </div>
    );
  }

  const pendingRevs = revisions.filter(r => r.status !== 'completed' && (r.planId === plan.id || r.planId === null)).length;

  return (
    <div className="roadmap-page">
      <header className="roadmap-head">
        <div>
          <div className="roadmap-head__title">
            <span className="roadmap-head__icon" aria-hidden="true">📖</span>
            <h1 className="t-h1">Study Roadmap</h1>
          </div>
          <p className="t-body roadmap-head__sub">
            {plan.name} · {tasks.length} problems · {pendingRevs} revisions pending
          </p>
        </div>
        <div className="roadmap-head__actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/generate-plan')}>
            + New Plan
          </button>
          <button type="button" className="btn-danger-outline" onClick={handleDeleteActive}>
            Delete Plan
          </button>
        </div>
      </header>

      <PlanStats plan={plan} tasks={tasks} revisions={revisions} />
      <Roadmap tasks={tasks} revisions={revisions.filter(r => r.planId === plan.id || r.planId === null)} originKey={originKey} />

      <ArchivedPlansList plans={archived} busyId={busyId} onRestore={handleRestore} onDelete={handleDeleteArchived} />

      <DeletePlanModal
        open={deleteOpen}
        plan={deleteTargetPlan}
        tasks={deleteTargetId === plan.id ? tasks : archived.find(p => p.id === deleteTargetId) ? [] : tasks}
        revisions={revisions}
        busy={!!busyId}
        onClose={() => { setDeleteOpen(false); setDeleteTargetId(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
