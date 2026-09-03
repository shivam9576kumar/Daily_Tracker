import type { Rating, Task } from '../../types';
import Button from '../common/Button';
import TaskRow from './TaskRow';
import './dashboard.css';

interface Props {
  pending: Task[];
  completed: Task[];
  busyId: string | null;
  onOpen: (task: Task) => void;
  onAddTask: () => void;
  onToggleSolved: (task: Task) => void;
  onRate: (task: Task, rating: Rating) => void;
  onUnrate: (task: Task) => void;
}

export default function TodaysHitlist({
  pending, completed, busyId, onOpen, onAddTask, onToggleSolved, onRate, onUnrate,
}: Props) {
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

  const unrated = completed.filter((t) => t.taskType === 'new' && !t.rating).length;

  return (
    <section>
      <div className="hitlist-header">
        <h2>⚡ Today's Hitlist</h2>
        <span className="hitlist-count">{pending.length} pending</span>
        <div className="hitlist-spacer" />
        <Button size="sm" onClick={onAddTask}>+ Add Task</Button>
      </div>

      {pending.length === 0 ? (
        completed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🎯</div>
            <div className="empty-text">No pending tasks for today. Add one to get started!</div>
            <Button onClick={onAddTask}>+ Add Your First Task</Button>
          </div>
        ) : (
          <div className="hitlist-alldone">
            🏁 All done for today.{' '}
            {unrated > 0
              ? `${unrated} solved problem${unrated === 1 ? '' : 's'} still without a revision plan — pick a rating below.`
              : 'Every solve has a revision plan. Nice.'}
          </div>
        )
      ) : (
        <div className="task-list">{pending.map(row)}</div>
      )}

      {completed.length > 0 && (
        <>
          <div className="section-divider">
            ✓ Completed Today ({completed.length}){' '}
            <span className="section-note">· tap the checkbox to unsolve · clears at midnight</span>
          </div>
          <div className="task-list">{completed.map(row)}</div>
        </>
      )}
    </section>
  );
}
