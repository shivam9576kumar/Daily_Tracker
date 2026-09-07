import { useNavigate } from 'react-router-dom';
import type { PotdStreak, Rating, Task } from '../../types';
import TaskRow from './TaskRow';
import './dashboard.css';

interface Props {
  hasActivePlan?: boolean;
  pending: Task[];
  completed: Task[];
  potdMeta?: { dateKey: string; stale: boolean } | null;
  potdStreak?: PotdStreak | null;
  busyId: string | null;
  onOpen: (task: Task) => void;
  onAddTask: () => void;
  onToggleSolved: (task: Task) => void;
  onRate: (task: Task, rating: Rating) => void;
  onUnrate: (task: Task) => void;
}

export default function TodaysHitlist({
  hasActivePlan = true,
  pending,
  completed,
  potdMeta,
  potdStreak,
  busyId,
  onOpen,
  onAddTask,
  onToggleSolved,
  onRate,
  onUnrate,
}: Props) {
  const navigate = useNavigate();

  const hasPotd = pending.some((t) => t.taskType === 'potd') || completed.some((t) => t.taskType === 'potd');

  const row = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      busy={busyId === t.id}
      onOpen={onOpen}
      onToggleSolved={onToggleSolved}
      onRate={onRate}
      onUnrate={onUnrate}
    />
  );

  return (
    <section className="hitlist-section">
      <div className="section-head">
        <div className="section-head__left">
          <h2 className="hitlist-title">Today's Hitlist</h2>
          <span className="hitlist-count">{pending.length}</span>
          {potdStreak && potdStreak.currentStreak > 0 && (
            <span
              className="hitlist-potd-streak"
              title="Consecutive days you solved the LeetCode Problem of the Day"
            >
              POTD ×{potdStreak.currentStreak}
            </span>
          )}
        </div>
        <button type="button" className="btn-primary" onClick={onAddTask}>+ Add Task</button>
      </div>

      {hasPotd && (
        <p className="hitlist-potd-note">
          Today's LeetCode POTD is included — it doesn't count toward your plan load.{potdMeta?.stale ? ' (showing latest available challenge)' : ''}
          {potdStreak && potdStreak.currentStreak === 0 && potdStreak.totalSolved > 0 && (
            <span> · Solve today's POTD to start a new streak.</span>
          )}
        </p>
      )}

      {pending.length === 0 ? (
        !hasActivePlan ? (
          <div className="empty-state card">
            <div className="empty-mono">// no active plan</div>
            <p className="empty-sub">
              Generate a plan to get a daily hitlist — your solved history and revision dates stay.
            </p>
            <button type="button" className="btn-secondary" onClick={() => navigate('/generate-plan')}>
              Generate Plan
            </button>
          </div>
        ) : completed.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-mono">// no pending tasks</div>
            <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={onAddTask}>
              + Add Task
            </button>
          </div>
        ) : null
      ) : (
        <div className="task-list">{pending.map(row)}</div>
      )}

      {completed.length > 0 && (
        <>
          <div className="section-divider">
            ✓ Completed Today ({completed.length}){' '}
            <span className="section-note">· tap checkbox to unsolve · clears at midnight</span>
          </div>
          <div className="task-list">{completed.map(row)}</div>
        </>
      )}
    </section>
  );
}
