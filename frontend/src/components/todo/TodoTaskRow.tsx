import type { MouseEvent } from 'react';
import type { Rating, Task } from '../../types';
import RatingPills from '../task/RatingPills';
import RevisionBadge from '../task/RevisionBadge';
import { resolvePlatform } from '../../utils/platform';
import { daysBetween, todayKey } from '../../utils/dateKeys';
import './todo.css';

interface Props {
  task: Task;
  busy?: boolean;
  onOpen: (task: Task) => void;
  onToggleSolved: (task: Task) => void;
  onRate: (task: Task, rating: Rating) => void;
  onUnrate: (task: Task) => void;
}

function scheduledKeyOf(task: Task): string | null {
  if (task.scheduledDateKey) return task.scheduledDateKey;
  const raw = task.scheduledDate?.slice(0, 10);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export default function TodoTaskRow({
  task, busy, onOpen, onToggleSolved, onRate, onUnrate,
}: Props) {
  const completed = task.status === 'completed';
  const isPotd = task.taskType === 'potd';
  const isRevision = task.taskType === 'revision';
  const isPersonal = task.taskType === 'personal';
  const canRate = completed && !isRevision && !isPersonal;
  const isBacklog = task.isBacklog && !completed;
  const plat = resolvePlatform(task.problemUrl, task.platform);

  let overdueDays = 0;
  if (isBacklog) {
    const key = scheduledKeyOf(task);
    if (key) overdueDays = Math.max(0, daysBetween(key, todayKey()));
  }

  const cls = [
    'todo-row',
    completed ? 'is-done' : '',
    isBacklog ? 'is-backlog' : '',
    busy ? 'is-busy' : '',
  ].filter(Boolean).join(' ');

  const stop = (e: MouseEvent) => e.stopPropagation();

  const openLink = (e: MouseEvent) => {
    e.stopPropagation();
    if (task.problemUrl) window.open(task.problemUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={cls}
      onClick={() => { if (!busy) onOpen(task); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
          e.preventDefault();
          onOpen(task);
        }
      }}
    >
      <input
        type="checkbox"
        className="todo-row__check"
        checked={completed}
        disabled={busy}
        aria-label={completed ? `Mark ${task.title} unsolved` : `Mark ${task.title} solved`}
        onChange={() => onToggleSolved(task)}
        onClick={stop}
      />

      <div className="todo-row__body">
        <div className="todo-row__title-line">
          <span className="todo-row__title">{task.title}</span>
          {isPotd && task.problemUrl && (
            <a
              href={task.problemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="todo-row__potd-link"
              onClick={stop}
              title="Open today's LeetCode problem"
            >
              ↗
            </a>
          )}
        </div>

        <div className="todo-row__meta">
          {isRevision && <RevisionBadge revisionNumber={task.revisionNumber} />}
          {isPotd && <span className="todo-row__potd">POTD</span>}
          {isPersonal ? (
            <span className="todo-row__topic">Personal</span>
          ) : (
            <>
              <span className="todo-row__topic">{task.topic}</span>
              {task.difficulty && (
                <span className={`todo-row__difficulty is-${task.difficulty}`}>
                  <span className="todo-row__difficulty-dot" aria-hidden="true" />
                  {task.difficulty}
                </span>
              )}
              {plat && plat.value !== 'custom' && (
                <span className="todo-row__platform">{plat.label}</span>
              )}
            </>
          )}
          {isBacklog && overdueDays > 0 && (
            <span className="todo-row__overdue">
              {overdueDays} day{overdueDays === 1 ? '' : 's'} overdue
            </span>
          )}
        </div>

        {canRate && (
          <div className="todo-row__rate" onClick={stop}>
            <span className="todo-row__rate-label">Revise?</span>
            <RatingPills
              value={task.rating}
              size="sm"
              disabled={busy}
              onRate={(r) => onRate(task, r)}
              onUnrate={() => onUnrate(task)}
            />
          </div>
        )}
      </div>

      {task.problemUrl && !isPotd && (
        <button
          type="button"
          className="todo-row__action"
          onClick={openLink}
          aria-label={`Open ${task.title}${plat ? ` on ${plat.label}` : ''}`}
          title={plat ? `Open on ${plat.label}` : 'Open problem'}
        >
          ↗
        </button>
      )}
    </div>
  );
}
