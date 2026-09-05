import type { Task } from '../../types';
import RevisionBadge from '../task/RevisionBadge';
import { IconLock } from '../common/icons';
import { resolvePlatform } from '../../utils/platform';
import './roadmap.css';

interface Props {
  task: Task;
  isToday: boolean;
  isFuture: boolean;
}

export default function RoadmapTaskRow({ task, isToday, isFuture }: Props) {
  const plat = resolvePlatform(task.problemUrl, task.platform);

  const rowState =
    task.status === 'completed' ? 'completed' :
    task.status === 'expired'   ? 'expired'   :
    task.isBacklog              ? 'backlog'   :
    isFuture                    ? 'locked'    : 'pending';

  const open = () => {
    if (task.problemUrl) window.open(task.problemUrl, '_blank', 'noopener,noreferrer');
  };

  const tooltip = task.taskType === 'revision'
    ? `Revision #${task.revisionNumber} — click to open the problem`
    : isFuture
    ? 'Locked — unlocks on its scheduled day'
    : plat
    ? `Click to open on ${plat.label}`
    : 'Click to open problem';

  return (
    <div
      className={`rtask is-${rowState}${isToday ? ' in-today' : ''}`}
      onClick={open}
      title={tooltip}
      style={{ cursor: task.problemUrl ? 'pointer' : 'default' }}
    >
      <span className="rtask__status" aria-hidden="true">
        {rowState === 'locked' && <IconLock />}
      </span>
      <div className="rtask__body">
        <span className="t-title rtask__title">{task.title}</span>
        <div className="rtask__meta">
          {task.taskType === 'revision' && <RevisionBadge revisionNumber={task.revisionNumber} />}
          <span className="pill pill-topic">{task.topic}</span>
          {task.difficulty && <span className={`pill pill-${task.difficulty}`}>{task.difficulty}</span>}
          {plat && plat.value !== 'custom' && (
            <span className="rtask__platform">{plat.label}</span>
          )}
          {rowState === 'backlog' && <span className="pill pill-outline-warning">Backlog</span>}
          {rowState === 'expired' && <span className="pill pill-outline-danger">Expired</span>}
        </div>
      </div>
    </div>
  );
}
