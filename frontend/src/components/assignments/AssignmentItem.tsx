import type { Assignment } from '../../types';
import './assignments.css';

interface Props {
  assignment: Assignment;
  busy?: boolean;
  onToggle: (a: Assignment) => void;
  onEdit: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
}

function deadlineLabel(a: Assignment) {
  const d = new Date(a.deadline);
  const text = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (a.urgency === 'today') return { cls: 'urgency-today', text: `Due today · ${text}` };
  if (a.urgency === 'tomorrow') return { cls: 'urgency-tomorrow', text: `Due tomorrow · ${text}` };
  return { cls: 'urgency-future', text: `Due ${text}` };
}

export default function AssignmentItem({
  assignment,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const completed = assignment.status === 'completed';
  const due = deadlineLabel(assignment);
  const rowCls = [
    'assignment-item',
    completed ? 'is-completed' : '',
    assignment.urgency === 'today' && !completed ? 'is-today' : '',
    assignment.urgency === 'tomorrow' && !completed ? 'is-tomorrow' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowCls}>
      <button
        className={`assignment-check ${completed ? 'is-on' : ''}`}
        disabled={busy}
        onClick={() => onToggle(assignment)}
        aria-label={completed ? 'Mark pending' : 'Mark complete'}
      >
        {completed ? '✓' : ''}
      </button>
      <div className="assignment-main">
        <div className="assignment-title">{assignment.title}</div>
        <div className="assignment-meta">
          <span className={due.cls}>{due.text}</span>
          {assignment.description && <span>{assignment.description}</span>}
        </div>
      </div>
      <div className="assignment-actions">
        <button className="icon-btn" onClick={() => onEdit(assignment)} title="Edit">
          ✎
        </button>
        <button className="icon-btn" onClick={() => onDelete(assignment)} title="Delete">
          🗑
        </button>
      </div>
    </div>
  );
}
