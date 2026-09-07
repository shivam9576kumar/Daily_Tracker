import { useCallback, useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { useTaskActions } from '../hooks/useTaskActions';
import TodaysHitlist from '../components/dashboard/TodaysHitlist';
import CompactStats from '../components/dashboard/CompactStats';
import PlanProgress from '../components/dashboard/PlanProgress';
import RevisionsPreview from '../components/dashboard/RevisionsPreview';
import CollegeStrip from '../components/dashboard/CollegeStrip';
import TaskDrawer from '../components/task/TaskDrawer';
import AddTaskModal from '../components/task/AddTaskModal';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import type { Task } from '../types';
import '../components/dashboard/dashboard.css';

export default function Dashboard() {
  const { data, loading, error, fetch } = useDashboardStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refresh = useCallback(() => fetch(true), [fetch]);
  const actions = useTaskActions(refresh);

  if (loading && !data) {
    return (
      <div className="dashboard">
        <Spinner large />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <div className="empty-emoji">😵</div>
          <div className="empty-text">{error}</div>
          <Button onClick={() => fetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalTasks = data.todaysHitlist.completed.length + data.todaysHitlist.pending.length;
  const dayProgress = totalTasks === 0
    ? 100
    : (data.todaysHitlist.completed.length / totalTasks) * 100;

  return (
    <div className="dashboard">
      {/* 1. Greeting + compact stats */}
      <CompactStats
        streak={data.statusOverview.streak}
        coins={data.statusOverview.coins}
        remaining={data.todaysHitlist.pending.length}
        activePlanName={data.activePlan?.name ?? null}
      />

      {/* 2. Plan progress */}
      {data.hasActivePlan && (
        <PlanProgress
          planName={data.activePlan?.name ?? ''}
          dayProgress={dayProgress}
        />
      )}

      {/* 3. Main hero: Today's Hitlist */}
      <TodaysHitlist
        hasActivePlan={data.hasActivePlan}
        pending={data.todaysHitlist.pending}
        completed={data.todaysHitlist.completed}
        potdMeta={data.potd}
        potdStreak={data.potdStreak}
        busyId={actions.busyId}
        onOpen={(t: Task) => setSelectedTaskId(t.id)}
        onAddTask={() => setAddOpen(true)}
        onToggleSolved={actions.toggleSolved}
        onRate={actions.rate}
        onUnrate={actions.unrate}
      />

      {/* 4. Upcoming revisions (collapsed) */}
      <RevisionsPreview revisions={data.upcomingRevisions ?? []} />

      {/* 5. College strip (classes + assignments collapsed) */}
      <CollegeStrip classes={data.classes ?? []} assignments={data.pendingAssignments ?? []} />

      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onChanged={refresh}
      />
      <AddTaskModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={refresh}
      />
    </div>
  );
}
