import type { Rating, Task } from '../../types';
import RevisionBadge from '../task/RevisionBadge';
import RatingPills from '../task/RatingPills';
import { resolvePlatform } from '../../utils/platform';
import { formatShortDate } from '../../utils/dateKeys';
import '../task/task.css';
import './dashboard.css';

interface Props {
  task: Task;
  busy?: boolean;
  onOpen: (task: Task) => void;
  onToggleSolved: (task: Task) => void;
  onRate: (task: Task, rating: Rating) => void;
  onUnrate: (task: Task) => void;
}

export default function TaskRow({ task, busy, onOpen, onToggleSolved, onRate, onUnrate }: Props) {
  const completed = task.status === 'completed';
  const isPotd = task.taskType === 'potd';
  const canRate = task.taskType !== 'revision';
  const plat = resolvePlatform(task.problemUrl, task.platform);

  const cls = [
    'task-row',
    completed ? 'is-done' : '',
    task.isBacklog && !completed ? 'is-backlog' : '',
    isPotd ? 'is-potd' : '',
    busy ? 'is-busy' : '',
  ].filter(Boolean).join(' ');

  const handleRowClick = () => {
    if (!busy) {
      onOpen(task);
    }
  };

  const handleLeetCodeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  };

  return (
    <div className={cls} onClick={handleRowClick} style={{ cursor: 'pointer' }}>
      <input
        type="checkbox"
        className="task-row__check"
        checked={completed}
        disabled={busy}
        onChange={(e) => { e.stopPropagation(); onToggleSolved(task); }}
        onClick={(e) => e.stopPropagation()}
        aria-label={completed ? `Mark ${task.title} unsolved` : `Mark ${task.title} solved`}
      />

      <div className="task-row__body">
        {isPotd && task.problemUrl ? (
          <a
            href={task.problemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="t-title task-row__title task-row__title--link"
            onClick={handleLeetCodeClick}
            title="Open today's LeetCode problem"
          >
            {task.title} ↗
          </a>
        ) : (
          <span className="t-title task-row__title">{task.title}</span>
        )}

        <div className="task-row__meta">
          {isPotd && (
            <span className="pill pill-potd" title="LeetCode Problem of the Day">
              POTD · {formatShortDate(task.potdDateKey ?? task.scheduledDate)}
            </span>
          )}
          {task.taskType === 'revision' && <RevisionBadge revisionNumber={task.revisionNumber} />}
          <span className="pill pill-topic">{task.topic}</span>
          {task.difficulty && <span className={`pill pill-${task.difficulty}`}>{task.difficulty}</span>}
          {plat && plat.value !== 'custom' && (
            <span className="task-row__platform">{plat.label}</span>
          )}
        </div>

        {completed && canRate && (
          <div className="task-rate-row" onClick={(e) => e.stopPropagation()}>
            <span className="task-rate-label t-label">Revise?</span>
            <RatingPills
              value={task.rating}
              size="sm"
              disabled={busy}
              onRate={(r) => onRate(task, r)}
              onUnrate={() => onUnrate(task)}
            />
            {!task.rating && <span className="task-rate-hint t-meta">Rate to schedule revisions</span>}
          </div>
        )}
      </div>
    </div>
  );
}
