import { useCallback, useEffect, useState } from 'react';
import Drawer from '../common/Drawer';
import Spinner from '../common/Spinner';
import RatingPills from './RatingPills';
import NotesEditor from './NotesEditor';
import { taskApi } from '../../services/taskApi';
import { potdApi } from '../../services/potdApi';
import { getErrorMessage } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { useTaskActions } from '../../hooks/useTaskActions';
import type { Task } from '../../types';
import { resolvePlatform } from '../../utils/platform';
import '../dashboard/dashboard.css';
import './task.css';

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function titleCase(s?: string | null) {
  if (!s) return '';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
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

  const statusChip = (() => {
    if (!task) return null;
    if (completed) return <span className="pill pill-success">Completed</span>;
    if (task.isBacklog) return <span className="pill pill-warning">Backlog</span>;
    if (task.status === 'expired') return <span className="pill pill-danger">Expired</span>;
    return null;
  })();

  const statusPill = (() => {
    if (!task) return null;
    if (completed) return <span className="pill pill-success">Completed</span>;
    if (task.isBacklog) return <span className="pill pill-warning">Backlog</span>;
    if (task.status === 'expired') return <span className="pill pill-danger">Expired</span>;
    return <span className="pill pill-count">Pending</span>;
  })();

  const header = (
    <header className="task-panel__head">
      <div className="task-panel__head-text">
        <h2 className="task-panel__title">{task?.title || 'Loading…'}</h2>
        {task && (
          <div className="task-panel__pills">
            {task.taskType === 'revision' && (
              <span className="pill pill-revision">Rev #{task.revisionNumber}</span>
            )}
            <span className="pill pill-topic">{titleCase(task.topic)}</span>
            {task.difficulty && (
              <span className={`pill pill-${task.difficulty}`}>
                {titleCase(task.difficulty)}
              </span>
            )}
            {statusChip}
          </div>
        )}
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
    </header>
  );

  const plat = resolvePlatform(task?.problemUrl, task?.platform);

  const footer = task && (
    <>
      {task.problemUrl && (
        <a
          href={task.problemUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Solve on {plat?.label ?? 'Problem'} ↗
        </a>
      )}

      {!completed ? (
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => actions.solve(task)}
        >
          {busy ? 'Saving...' : '✓ Mark as Solved'}
        </button>
      ) : (
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => actions.unsolve(task)}
        >
          {busy ? 'Updating...' : 'Undo solve'}
        </button>
      )}

      {task.taskType === 'potd' && (
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("Hide today's POTD? It won't come back today.")) return;
            await potdApi.dismiss(task.potdDateKey!);
            await onChanged();
            onClose();
          }}
        >
          Hide today's POTD
        </button>
      )}

      <button
        type="button"
        className="btn-danger-outline"
        disabled={busy}
        onClick={handleDelete}
      >
        {deleting ? 'Deleting...' : 'Delete Task'}
      </button>
    </>
  );

  return (
    <Drawer open={!!taskId} onClose={onClose} header={header} footer={footer}>
      {loading || !task ? (
        <Spinner large />
      ) : (
        <>
          {completed && (
            <div className="banner banner--success" style={{ margin: '0 0 16px' }}>
              {task.rating
                ? `Solved · ${titleCase(task.rating)} · ${revPending + revDone} revisions scheduled`
                : 'Solved — rate it to schedule revisions.'}
            </div>
          )}

          <dl className="kv">
            <div className="kv__row">
              <dt className="kv__k">Status</dt>
              <dd className="kv__v">{statusPill}</dd>
            </div>
            <div className="kv__row">
              <dt className="kv__k">Type</dt>
              <dd className="kv__v">{titleCase(task.taskType)}</dd>
            </div>
            <div className="kv__row">
              <dt className="kv__k">Platform</dt>
              <dd className="kv__v">{plat?.label || '—'}</dd>
            </div>
            <div className="kv__row">
              <dt className="kv__k">Scheduled</dt>
              <dd className="kv__v">{fmt(task.scheduledDate)}</dd>
            </div>
            {task.completedAt && (
              <div className="kv__row">
                <dt className="kv__k">Solved on</dt>
                <dd className="kv__v">{fmt(task.completedAt)}</dd>
              </div>
            )}
            {isRevision && task.originalSolveDate && (
              <div className="kv__row">
                <dt className="kv__k">Original solve</dt>
                <dd className="kv__v">{fmt(task.originalSolveDate)}</dd>
              </div>
            )}
            {task.rating && (
              <div className="kv__row">
                <dt className="kv__k">Rating</dt>
                <dd className="kv__v">
                  <span className={`pill pill-${task.rating}`}>
                    {titleCase(task.rating)}
                  </span>
                </dd>
              </div>
            )}
          </dl>

          {isRevision && task.parentTask && (
            <div className="revision-summary">
              <div className="revision-summary-title">Revision #{task.revisionNumber}</div>
              <div className="revision-summary-text">Original problem: {task.parentTask.title}</div>
              <div className="revision-parent-note">Complete this revision to strengthen long-term memory.</div>
            </div>
          )}

          {isNew && !completed && (
            <div className="task-panel__hint">
              Mark as solved first — then pick Easy / Medium / Hard here to schedule spaced revisions.
            </div>
          )}

          {task.status === 'completed' && task.taskType !== 'revision' && (
            <div className="revise-box">
              <div className="revise-box__title">How hard was it?</div>
              <RatingPills
                value={task.rating}
                size="md"
                disabled={busy}
                onRate={(r) => actions.rate(task, r)}
                onUnrate={() => actions.unrate(task)}
              />
              <p className="revise-help">
                {task.rating ? (
                  <>
                    Rated <strong>{titleCase(task.rating)}</strong> · {revPending} upcoming{revDone > 0 ? `, ${revDone} done` : ''}. Tap the pill again to remove the plan — the solve still counts.
                  </>
                ) : (
                  <>Easy: +14 and +28 days. Medium: +1, +3, +7, +14. Hard: +1, +3, +7, +14, +28.</>
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
