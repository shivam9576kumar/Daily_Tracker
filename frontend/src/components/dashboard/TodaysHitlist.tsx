import type { Task } from '../../types';
import Button from '../common/Button';
import TaskRow from './TaskRow';
import './dashboard.css';

interface Props {
  pending: Task[];
  completed: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: () => void;
}

export default function TodaysHitlist({
  pending,
  completed,
  onTaskClick,
  onAddTask,
}: Props) {
  return (
    <section>
      <div className="hitlist-header">
        <h2>⚡ Today's Hitlist</h2>
        <span className="hitlist-count">{pending.length} pending</span>
        <div className="hitlist-spacer" />
        <Button size="sm" onClick={onAddTask}>
          + Add Task
        </Button>
      </div>

      {pending.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🎯</div>
          <div className="empty-text">
            No pending tasks for today. Add one to get started!
          </div>
          <Button onClick={onAddTask}>+ Add Your First Task</Button>
        </div>
      ) : (
        <div className="task-list">
          {pending.map((t) => (
            <TaskRow key={t.id} task={t} onClick={onTaskClick} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <div className="section-divider">
            ✓ Completed Today ({completed.length})
          </div>
          <div className="task-list">
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} onClick={onTaskClick} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
