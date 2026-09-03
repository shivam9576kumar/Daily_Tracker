import type { Task } from '../../types';
import RevisionBadge from '../task/RevisionBadge';
import '../dashboard/dashboard.css';
import './roadmap.css';

interface Props {
  task: Task;
  isToday: boolean;
  isFuture: boolean;
}

function statusIcon(task: Task, isFuture: boolean) {
  if (task.status === 'completed') return { icon: '✓', cls: 'done' };
  if (isFuture) return { icon: '🔒', cls: 'locked' };
  return { icon: '○', cls: 'pending' };
}

export default function RoadmapTaskRow({ task, isToday, isFuture }: Props) {
  const isRevision = task.taskType === 'revision';
  const completed = task.status === 'completed';
  const s = statusIcon(task, isFuture);

  // Roadmap is read-only: clicking only opens the problem. Completion happens on the Dashboard.
  const open = () => {
    if (task.problemUrl) window.open(task.problemUrl, '_blank', 'noopener,noreferrer');
  };

  const cls = [
    'roadmap-task',
    completed ? 'is-completed' : '',
    isFuture ? 'is-future' : '',
    isRevision ? 'is-revision' : '',
  ].filter(Boolean).join(' ');

  const tooltip = isRevision
    ? `Revision #${task.revisionNumber} — click to open the problem`
    : isFuture
    ? 'Locked — unlocks on its scheduled day'
    : 'Click to open on LeetCode';

  return (
    <div className={cls} onClick={open} title={tooltip} style={{ cursor: task.problemUrl ? 'pointer' : 'default' }}>
      <div className={`rt-status ${s.cls}`}>{s.icon}</div>
      <div className="rt-main">
        <div className="rt-title">{task.title}</div>
        <div className="rt-tags">
          {isRevision && <RevisionBadge revisionNumber={task.revisionNumber} />}
          <span className="tag tag-topic">{task.topic}</span>
          {task.difficulty && <span className={`tag tag-${task.difficulty}`}>{task.difficulty}</span>}
          {isToday && <span className="tag tag-platform">Today</span>}
          {task.isBacklog && !completed && <span className="tag tag-backlog">Backlog</span>}
        </div>
      </div>
    </div>
  );
}
