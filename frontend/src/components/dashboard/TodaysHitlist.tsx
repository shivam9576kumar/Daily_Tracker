import { useState } from 'react';
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
  const [showCompleted, setShowCompleted] = useState(true);

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
    <section>
      <div className="section-head">
        <div className="section-head__left">
          <span className="section-head__icon" aria-hidden="true">⚡</span>
          <h2 className="t-h2">Today's Hitlist</h2>
          <span className="pill pill-count is-brand">{pending.length} pending</span>
          {potdStreak && potdStreak.currentStreak > 0 && (
            <span
              className="pill pill-potd-streak"
              title="Consecutive days you solved the LeetCode Problem of the Day"
            >
              ⚡ {potdStreak.currentStreak}-day POTD streak
            </span>
          )}
        </div>
        <button type="button" className="btn-primary" onClick={onAddTask}>+ Add Task</button>
      </div>

      {hasPotd && (
        <p className="hitlist-potd-note t-meta">
          ⚡ LeetCode POTD included — doesn't count toward plan load.{potdMeta?.stale ? ' (showing latest challenge)' : ''}
        </p>
      )}

      {pending.length === 0 ? (
        !hasActivePlan ? (
          <div className="empty-state card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div className="empty-emoji">🌱</div>
            <h3 className="t-h2" style={{ margin: '0 0 6px' }}>No active plan</h3>
            <p className="t-body" style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>
              Generate a plan to get a daily hitlist — your solved history and revision dates stay.
            </p>
            <button type="button" className="btn-primary" onClick={() => navigate('/generate-plan')}>
              Generate Plan
            </button>
          </div>
        ) : (
          <div className="empty-state card">
            <div className="empty-emoji">🎉</div>
            <div className="empty-text t-body">All done for today! Add one or enjoy your day.</div>
            <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={onAddTask}>
              + Add Task
            </button>
          </div>
        )
      ) : (
        <div className="task-list">{pending.map(row)}</div>
      )}

      {completed.length > 0 && (
        <>
          <button
            type="button"
            className="completed-toggle"
            onClick={() => setShowCompleted((o) => !o)}
          >
            <span>✓ Completed Today ({completed.length})</span>
            <span className="mono">{showCompleted ? '−' : '+'}</span>
          </button>
          {showCompleted && (
            <div className="task-list completed-list">
              {completed.map(row)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
