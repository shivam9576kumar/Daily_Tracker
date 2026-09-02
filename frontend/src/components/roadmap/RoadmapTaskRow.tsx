import type { Task } from '../../types';
import './roadmap.css';

interface Props {
  task: Task;
  isToday: boolean;
  isFuture: boolean;
}

function getStatusIcon(task: Task, isFuture: boolean) {
  if (task.status === 'completed') return { icon: '✓', cls: 'done' };
  if (isFuture) return { icon: '🔒', cls: 'locked' };
  return { icon: '○', cls: 'pending' };
}

export default function RoadmapTaskRow({ task, isToday, isFuture }: Props) {
  const status = getStatusIcon(task, isFuture);

  const handleClick = () => {
    if (!task.problemUrl) return;
    window.open(task.problemUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`roadmap-task ${task.status === 'completed' ? 'is-completed' : ''} ${isFuture ? 'is-future' : ''}`}
      onClick={handleClick}
      title={isFuture ? 'Locked - will unlock on scheduled day' : 'Click to solve on LeetCode'}
      style={{ cursor: task.problemUrl ? 'pointer' : 'default' }}
    >
      <div className={`rt-status ${status.cls}`}>{status.icon}</div>
      <div className="rt-main">
        <div className="rt-title">{task.title}</div>
        <div className="rt-tags">
          <span className="tag tag-topic">{task.topic}</span>
          {task.difficulty && <span className={`tag tag-${task.difficulty}`}>{task.difficulty}</span>}
          {isToday && <span className="tag tag-platform">Today</span>}
        </div>
      </div>
    </div>
  );
}
