import type { Rating, Task } from '../../types';
import RevisionBadge from '../task/RevisionBadge';
import RatingPills from '../task/RatingPills';
import './dashboard.css';

interface Props {
  task: Task;
  busy?: boolean;
  onOpen: (task: Task) => void;                 // click anywhere on the row → drawer
  onToggleSolved: (task: Task) => void;         // checkbox
  onRate: (task: Task, rating: Rating) => void; // dim pill
  onUnrate: (task: Task) => void;               // bright pill
}

export default function TaskRow({ task, busy, onOpen, onToggleSolved, onRate, onUnrate }: Props) {
  const completed = task.status === 'completed';
  const isNew = task.taskType === 'new';

  const cls = [
    'task-row',
    completed ? 'is-completed' : '',
    task.isBacklog && !completed ? 'is-backlog' : '',
    busy ? 'is-busy' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={() => onOpen(task)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={completed}
        aria-label={completed ? 'Mark as unsolved' : 'Mark as solved'}
        className={`task-check ${completed ? 'checked' : ''}`}
        disabled={busy}
        onClick={(e) => { e.stopPropagation(); onToggleSolved(task); }}
      >
        {completed && '✓'}
      </button>

      <div className="task-main">
        <div className="task-title">{task.title}</div>

        <div className="task-tags">
          <span className="tag tag-topic">{task.topic}</span>
          {task.difficulty && <span className={`tag tag-${task.difficulty}`}>{task.difficulty}</span>}
          {task.taskType === 'revision' && <RevisionBadge revisionNumber={task.revisionNumber} />}
          {task.isBacklog && !completed && <span className="tag tag-backlog">Backlog</span>}
          {task.platform && task.platform !== 'custom' && <span className="tag tag-platform">{task.platform}</span>}
        </div>

        {completed && isNew && (
          <div className="task-rate-row" onClick={(e) => e.stopPropagation()}>
            <span className="task-rate-label">Revise?</span>
            <RatingPills
              value={task.rating}
              size="sm"
              disabled={busy}
              onRate={(r) => onRate(task, r)}
              onUnrate={() => onUnrate(task)}
            />
            {!task.rating && <span className="task-rate-hint">No revision plan yet</span>}
          </div>
        )}
      </div>
    </div>
  );
}
