import { assignmentApi } from '../../services/taskApi';

interface Assignment {
  id: string;
  title: string;
  deadline: string;
  urgency: 'today' | 'tomorrow' | 'future';
}

interface Props {
  assignments: Assignment[];
  onUpdate: () => void;
}

export default function PendingAssignments({ assignments, onUpdate }: Props) {
  if (assignments.length === 0) return null;

  const handleDone = async (id: string) => {
    try {
      await assignmentApi.markDone(id);
      onUpdate(); // Refresh dashboard
    } catch (err) {
      console.error('Failed to complete assignment:', err);
    }
  };

  const urgencyLabel = {
    today: '🔴 Today',
    tomorrow: '🟠 Tomorrow',
    future: '🟢 Future',
  };

  return (
    <div className="assignments-section" id="assignments-section">
      <div className="section-header">
        <h3 className="section-title">📋 Pending Assignments</h3>
        <span className="section-count">{assignments.length}</span>
      </div>

      {assignments.map((a) => (
        <div key={a.id} className="assignment-item">
          <button
            className="assignment-checkbox"
            onClick={() => handleDone(a.id)}
            aria-label={`Mark ${a.title} as done`}
          >
            ✓
          </button>
          <span className="assignment-title">{a.title}</span>
          <span className={`assignment-deadline urgency-${a.urgency}`}>
            {urgencyLabel[a.urgency]}
          </span>
        </div>
      ))}
    </div>
  );
}
