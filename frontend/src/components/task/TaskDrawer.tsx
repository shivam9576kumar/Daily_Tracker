import { useCallback, useEffect, useState } from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import RevisionBadge from './RevisionBadge';
import RatingPills from './RatingPills';
import NotesEditor from './NotesEditor';
import { taskApi } from '../../services/taskApi';
import { getErrorMessage } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { useTaskActions } from '../../hooks/useTaskActions';
import type { Task } from '../../types';
import '../dashboard/dashboard.css';
import './task.css';

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  taskId: string | null;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

export default function TaskDrawer({ taskId, onClose, onChanged }: Props) {
  const toast = useUIStore((s) => s.toast);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setTask(await taskApi.getById(id));
    } catch (err) {
      toast(getErrorMessage(err), 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [toast, onClose]);

  useEffect(() => {
    if (taskId) load(taskId);
    else setTask(null);
  }, [taskId, load]);

  // After any action: reload this task, then let the dashboard refresh
  const afterChange = useCallback(async () => {
    if (taskId) await load(taskId);
    await onChanged();
  }, [taskId, load, onChanged]);

  const actions = useTaskActions(afterChange);

  if (!taskId) return null;

  const busy = !!task && (actions.busyId === task.id || deleting);
  const completed = task?.status === 'completed';
  const isNew = task?.taskType === 'new';
  const isRevision = task?.taskType === 'revision';
  const revisions = task?.revisions ?? [];
  const revDone = revisions.filter((r) => r.status === 'completed').length;
  const revPending = revisions.length - revDone;

  const handleDelete = async () => {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"? This also removes its revisions and cannot be undone.`)) return;
    setDeleting(true);
    try {
      await taskApi.remove(task.id);
      toast('Task deleted', 'info');
      await onChanged();
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const header = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 className="drawer-title">{task?.title || 'Loading…'}</h3>
      {task && (
        <div className="drawer-tags">
          <span className="tag tag-topic">{task.topic}</span>
          {task.difficulty && <span className={`tag tag-${task.difficulty}`}>{task.difficulty}</span>}
          {isRevision && <RevisionBadge revisionNumber={task.revisionNumber} />}
          {task.isBacklog && !completed && <span className="tag tag-backlog">Backlog</span>}
        </div>
      )}
    </div>
  );

  const footer = task && (
    <>
      {task.problemUrl && (
        <Button variant="secondary" block onClick={() => window.open(task.problemUrl!, '_blank', 'noopener,noreferrer')}>
          🔗 Solve on {task.platform}
        </Button>
      )}

      {!completed ? (
        <Button block loading={busy} onClick={() => actions.solve(task)}>✓ Mark as Solved</Button>
      ) : (
        <Button variant="secondary" block loading={busy} onClick={() => actions.unsolve(task)}>↩ Mark as Unsolved</Button>
      )}

      <Button variant="danger" block disabled={busy} onClick={handleDelete}>🗑 Delete Task</Button>
    </>
  );

  return (
    <Drawer open={!!taskId} onClose={onClose} header={header} footer={footer}>
      {loading || !task ? (
        <Spinner large />
      ) : (
        <>
          <div className="meta-list">
            <div className="meta-row">
              <span className="meta-key">Status</span>
              <span className="meta-val">{completed ? '✅ Solved' : task.isBacklog ? '⚠️ Backlog' : '⏳ Pending'}</span>
            </div>
            <div className="meta-row"><span className="meta-key">Type</span><span className="meta-val">{task.taskType}</span></div>
            <div className="meta-row"><span className="meta-key">Platform</span><span className="meta-val">{task.platform || '—'}</span></div>
            <div className="meta-row"><span className="meta-key">Scheduled</span><span className="meta-val">{fmt(task.scheduledDate)}</span></div>
            {task.completedAt && (
              <div className="meta-row"><span className="meta-key">Solved On</span><span className="meta-val">{fmt(task.completedAt)}</span></div>
            )}
            {isRevision && task.originalSolveDate && (
              <div className="meta-row"><span className="meta-key">First Solved</span><span className="meta-val">{fmt(task.originalSolveDate)}</span></div>
            )}
          </div>

          {isRevision && task.parentTask && (
            <div className="revision-summary">
              <div className="revision-summary-title">Revision #{task.revisionNumber}</div>
              <div className="revision-summary-text">Original problem: {task.parentTask.title}</div>
              <div className="revision-parent-note">Complete this revision to strengthen long-term memory.</div>
            </div>
          )}

          {isNew && !completed && (
            <div className="solve-first-note">
              Mark as solved first — then pick Easy / Medium / Hard here to schedule spaced revisions.
            </div>
          )}

          {isNew && completed && (
            <div className="revise-box">
              <div className="drawer-section-title">🔁 Revise this problem?</div>
              <RatingPills
                value={task.rating}
                size="md"
                disabled={busy}
                onRate={(r) => actions.rate(task, r)}
                onUnrate={() => actions.unrate(task)}
              />
              <p className="revise-help">
                {task.rating ? (
                  <>Rated <strong>{task.rating}</strong> · {revPending} upcoming, {revDone} done. Tap the bright pill again to remove
                  the plan — the solve still counts. Upcoming revisions also appear on your Roadmap.</>
                ) : (
                  <>No revision plan yet. Pick how hard it felt to schedule spaced revisions — coins and streak are already counted.</>
                )}
              </p>
            </div>
          )}

          {revisions.length > 0 && (
            <>
              <div className="drawer-section-title">🔁 Scheduled Revisions ({revisions.length})</div>
              <div className="rev-list">
                {revisions.map((r) => (
                  <div key={r.id} className="rev-item">
                    <span className="rev-num">#{r.revisionNumber}</span>
                    <span className="rev-date">{fmt(r.scheduledDate)}</span>
                    <span className={r.status === 'completed' ? 'rev-done' : 'rev-pending'}>
                      {r.status === 'completed' ? 'DONE' : r.status === 'backlog' ? 'BACKLOG' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <NotesEditor key={task.id} taskId={task.id} initialContent={task.notes || ''} />
        </>
      )}
    </Drawer>
  );
}
