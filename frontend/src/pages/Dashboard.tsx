import { useEffect, useState } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import StatusOverview from '../components/dashboard/StatusOverview';
import VibeBanner from '../components/dashboard/VibeBanner';
import PendingAssignments from '../components/assignments/PendingAssignments';
import TodaysHitlist from '../components/dashboard/TodaysHitlist';
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

  const refresh = () => fetch(true);

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

  return (
    <div className="dashboard">
      <StatusOverview data={data.statusOverview} />
      <VibeBanner vibe={data.vibe} />
      <PendingAssignments
        pending={data.pendingAssignments || []}
        onChanged={refresh}
      />
      <TodaysHitlist
        pending={data.todaysHitlist.pending}
        completed={data.todaysHitlist.completed}
        onTaskClick={(t: Task) => setSelectedTaskId(t.id)}
        onAddTask={() => setAddOpen(true)}
      />
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
