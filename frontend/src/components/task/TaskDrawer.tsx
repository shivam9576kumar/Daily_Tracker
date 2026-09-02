import { useEffect, useState } from 'react';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import RatingModal from './RatingModal';
import NotesEditor from './NotesEditor';
import { taskApi } from '../../services/taskApi';
import { getErrorMessage } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import type { Rating, Task } from '../../types';
import './task.css';

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  taskId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function TaskDrawer({ taskId, onClose, onChanged }: Props) {
  const toast = useUIStore((s) => s.toast);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rerating, setRerating] = useState(false);

  const load = async (id: string) => {
    setLoading(true);
    try {
      setTask(await taskApi.getById(id));
    } catch (err) {
      toast(getErrorMessage(err), 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) load(taskId);
    else setTask(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!taskId) return null;

  const completed = task?.status === 'completed';
  const isNew = task?.taskType === 'new';

  const revisionTotal = task?.revisions?.length || 0;
  const revisionCompleted =
    task?.revisions?.filter((r) => r.status === 'completed').length || 0;
  const revisionPending = revisionTotal - revisionCompleted;

  /** Mark done: new tasks open rating modal, revisions complete instantly. */
  const handleMarkDone = async () => {
    if (!task) return;
    if (isNew) {
      setRerating(false);
      setRatingOpen(true);
      return;
    }
    setBusy(true);
    try {
      await taskApi.complete(task.id);
      toast('Revision completed! +5 coins', 'success');
      await load(task.id);
      onChanged();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRatingSubmit = async (rating: Rating) => {
    if (!task) return;
    setBusy(true);
    try {
      if (rerating) {
        await taskApi.rerate(task.id, rating);
        toast(`Re-rated as ${rating} — revisions rescheduled`, 'success');
      } else {
        await taskApi.complete(task.id, rating);
        toast(`Completed as ${rating}! Revisions scheduled 🔁`, 'success');
      }
      setRatingOpen(false);
      await load(task.id);
      onChanged();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await taskApi.undo(task.id);
      toast('Completion undone', 'info');
      await load(task.id);
      onChanged();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`))
      return;
    setBusy(true);
    try {
      await taskApi.remove(task.id);
      toast('Task deleted', 'info');
      onChanged();
      onClose();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 className="drawer-title">{task?.title || 'Loading…'}</h3>
      {task && (
        <div className="drawer-tags">
          <span className="tag tag-topic">{task.topic}</span>
          {task.difficulty && (
            <span className={`tag tag-${task.difficulty}`}>
              {task.difficulty}
            </span>
          )}
          {task.taskType === 'revision' && (
            <span className="tag tag-revision">
              Revision #{task.revisionNumber}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const footer = task && (
    <>
      {task.problemUrl && (
        <Button
          variant="secondary"
          block
          onClick={() => window.open(task.problemUrl!, '_blank')}
        >
          🔗 Solve on {task.platform}
        </Button>
      )}

      {!completed && (
        <Button block loading={busy} onClick={handleMarkDone}>
          ✓ Mark as Done
        </Button>
      )}

      {completed && (
        <>
          {isNew && (
            <Button
              variant="secondary"
              block
              disabled={busy}
              onClick={() => {
                setRerating(true);
                setRatingOpen(true);
              }}
            >
              ⭐ Change Rating
            </Button>
          )}
          <Button
            variant="secondary"
            block
            loading={busy}
            onClick={handleUndo}
          >
            ↩ Undo Completion
          </Button>
        </>
      )}

      <Button
        variant="danger"
        block
        disabled={busy}
        onClick={handleDelete}
      >
        🗑 Delete Task
      </Button>
    </>
  );

  return (
    <>
      <Drawer
        open={!!taskId}
        onClose={onClose}
        header={header}
        footer={footer}
      >
        {loading || !task ? (
          <Spinner large />
        ) : (
          <>
            {task.taskType === 'revision' && task.parentTask && (
              <div className="revision-summary">
                <div className="revision-summary-title">
                  Revision #{task.revisionNumber}
                </div>
                <div className="revision-summary-text">
                  Original problem: {task.parentTask.title}
                </div>
                <div className="revision-parent-note">
                  Complete this revision to strengthen long-term memory.
                </div>
              </div>
            )}

            {task.taskType === 'new' && revisionTotal > 0 && (
              <div className="revision-summary">
                <div className="revision-summary-title">
                  Revision Progress
                </div>
                <div className="revision-summary-text">
                  {revisionCompleted} of {revisionTotal} revisions completed.
                  {revisionPending > 0
                    ? ` ${revisionPending} remaining.`
                    : ' All done.'}
                </div>
                <div className="revision-parent-note">
                  Undoing this problem will delete unfinished revisions, but completed revisions are preserved.
                </div>
              </div>
            )}

            {task.taskType === 'new' &&
              task.status === 'completed' &&
              revisionTotal === 0 && (
                <div className="revision-empty">
                  No pending revision schedule exists for this task.
                </div>
              )}

            <div className="meta-list">
              <div className="meta-row">
                <span className="meta-key">Status</span>
                <span className="meta-val">
                  {completed
                    ? '✅ Completed'
                    : task.isBacklog
                    ? '⚠️ Backlog'
                    : '⏳ Pending'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Type</span>
                <span className="meta-val">{task.taskType}</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Platform</span>
                <span className="meta-val">{task.platform || '—'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-key">Scheduled</span>
                <span className="meta-val">{fmt(task.scheduledDate)}</span>
              </div>
              {task.rating && (
                <div className="meta-row">
                  <span className="meta-key">Your Rating</span>
                  <span
                    className="meta-val"
                    style={{ textTransform: 'capitalize' }}
                  >
                    {task.rating}
                  </span>
                </div>
              )}
              {task.completedAt && (
                <div className="meta-row">
                  <span className="meta-key">Completed On</span>
                  <span className="meta-val">{fmt(task.completedAt)}</span>
                </div>
              )}
              {task.originalSolveDate && task.taskType === 'revision' && (
                <div className="meta-row">
                  <span className="meta-key">First Solved</span>
                  <span className="meta-val">
                    {fmt(task.originalSolveDate)}
                  </span>
                </div>
              )}
            </div>

            {task.revisions && task.revisions.length > 0 && (
              <>
                <div className="drawer-section-title">
                  🔁 Scheduled Revisions ({task.revisions.length})
                </div>
                <div className="rev-list">
                  {task.revisions.map((r) => (
                    <div key={r.id} className="rev-item">
                      <span className="rev-num">#{r.revisionNumber}</span>
                      <span className="rev-date">{fmt(r.scheduledDate)}</span>
                      <span
                        className={
                          r.status === 'completed' ? 'rev-done' : 'rev-pending'
                        }
                      >
                        {r.status === 'completed' ? 'DONE' : 'PENDING'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <NotesEditor
              key={task.id}
              taskId={task.id}
              initialContent={task.notes || ''}
            />
          </>
        )}
      </Drawer>

      {task && (
        <RatingModal
          open={ratingOpen}
          taskTitle={task.title}
          currentRating={task.rating}
          submitting={busy}
          onClose={() => setRatingOpen(false)}
          onSubmit={handleRatingSubmit}
        />
      )}
    </>
  );
}
