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
        <div className="empty-roadmap">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚠️ {error}</div>
          <Button onClick={() => fetchActive()}>Retry</Button>
        </div>
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
        <div className="roadmap-header">
          <div>
            <h1 className="roadmap-title">📖 Study Roadmap</h1>
            <p className="roadmap-subtitle">Your weekly journey towards DSA mastery.</p>
          </div>
        </div>
        <div className="empty-roadmap">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>🚀 No Active Study Plan</div>
          <div style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
            Create one with AI to get a customized, balanced schedule.
          </div>
          <Button onClick={() => navigate('/generate-plan')}>✨ Generate Study Plan</Button>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="roadmap-page">
        <div className="roadmap-header">
          <div>
            <h1 className="roadmap-title">🔁 Upcoming Revisions</h1>
            <p className="roadmap-subtitle">No active plan. These are revisions from problems you've rated.</p>
          </div>
          <Button onClick={() => navigate('/generate-plan')}>✨ Generate Study Plan</Button>
        </div>
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

  return (
    <div className="roadmap-page">
      <div className="roadmap-header">
        <div>
          <h1 className="roadmap-title">📖 Study Roadmap</h1>
          <p className="roadmap-subtitle">{plan.name} · {tasks.length} problems · {revisions.filter(r => r.status !== 'completed' && r.planId === plan.id).length} revisions pending</p>
        </div>
        <div className="roadmap-actions">
          <Button variant="secondary" onClick={() => navigate('/generate-plan')}>+ New Plan</Button>
          <button className="btn-danger-outline" onClick={handleDeleteActive}>Delete Plan</button>
        </div>
      </div>

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
