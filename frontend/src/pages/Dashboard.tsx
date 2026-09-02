import { useEffect, useCallback } from 'react';
import { useTaskStore } from '../store/taskStore';
import { taskApi } from '../services/taskApi';
import AppLayout from '../components/layout/AppLayout';
import StatusOverview from '../components/dashboard/StatusOverview';
import VibeBanner from '../components/dashboard/VibeBanner';
import PendingAssignments from '../components/dashboard/PendingAssignments';
import TodaysHitlist from '../components/dashboard/TodaysHitlist';
import TaskDrawer from '../components/task/TaskDrawer';

export default function Dashboard() {
  const { dashboard, setDashboard, isLoading, setLoading } = useTaskStore();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskApi.getDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [setDashboard, setLoading]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading && !dashboard) {
    return (
      <AppLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}>
          <div className="spinner" />
        </div>
      </AppLayout>
    );
  }

  if (!dashboard) {
    return (
      <AppLayout>
        <div className="empty-state">
          <div className="empty-state__emoji">📭</div>
          <div className="empty-state__text">
            Could not load dashboard. Please try again.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="dashboard-grid">
        <StatusOverview {...dashboard.statusOverview} />
        <VibeBanner {...dashboard.vibe} />
        <PendingAssignments
          assignments={dashboard.pendingAssignments}
          onUpdate={fetchDashboard}
        />
        <TodaysHitlist
          pendingTasks={dashboard.todaysHitlist.pending}
          completedTasks={dashboard.todaysHitlist.completed}
        />
      </div>
      <TaskDrawer onUpdate={fetchDashboard} />
    </AppLayout>
  );
}
