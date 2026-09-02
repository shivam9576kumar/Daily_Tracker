import type { Task } from '../../types';
import RevisionBadge from '../task/RevisionBadge';
import './dashboard.css';

interface Props {
  task: Task;
  onClick: (task: Task) => void;
}

export default function TaskRow({ task, onClick }: Props) {
  const completed = task.status === 'completed';
  const classes = [
    'task-row',
    completed ? 'is-completed' : '',
    task.isBacklog && !completed ? 'is-backlog' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={() => onClick(task)}>
      <div className={`task-check ${completed ? 'checked' : ''}`}>
        {completed && '✓'}
      </div>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        <div className="task-tags">
          <span className="tag tag-topic">{task.topic}</span>
          {task.difficulty && (
            <span className={`tag tag-${task.difficulty}`}>
              {task.difficulty}
            </span>
          )}
          {task.taskType === 'revision' && (
            <RevisionBadge revisionNumber={task.revisionNumber} />
          )}
          {task.isBacklog && task.status !== 'completed' && (
            <span className="tag tag-backlog">Backlog</span>
          )}
          {task.isExpired && (
            <span className="tag tag-backlog">Expired</span>
          )}
          {task.platform && task.platform !== 'custom' && (
            <span className="tag tag-platform">{task.platform}</span>
          )}
        </div>
      </div>
    </div>
  );
}
