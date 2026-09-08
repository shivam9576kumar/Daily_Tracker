import type { Assignment } from '../../types';
import { formatKey } from '../../utils/dateKeys';
import './todo.css';

interface Props {
  assignment: Assignment;
  busy: boolean;
  onToggle: (assignment: Assignment) => void;
}

export default function TodoAssignmentRow({ assignment, busy, onToggle }: Props) {
  const completed = assignment.status === 'completed';
  const dueKey = assignment.deadline?.slice(0, 10);

  return (
    <div className={`todo-row todo-row--assignment${completed ? ' is-done' : ''}`}>
      <input
        type="checkbox"
        className="todo-row__check"
        checked={completed}
        disabled={busy}
        aria-label={completed ? `Reopen ${assignment.title}` : `Complete ${assignment.title}`}
        onChange={() => onToggle(assignment)}
      />
      <div className="todo-row__body">
        <div className="todo-row__title-line">
          <span className="todo-row__title">{assignment.title}</span>
        </div>
        <div className="todo-row__meta">
          <span className="todo-row__topic">Assignment</span>
          {dueKey && <span className="todo-row__platform">Due {formatKey(dueKey)}</span>}
          {assignment.description && (
            <span className="todo-row__platform">{assignment.description}</span>
          )}
        </div>
      </div>
    </div>
  );
}
