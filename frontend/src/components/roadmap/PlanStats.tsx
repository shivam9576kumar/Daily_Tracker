import type { Plan, Task } from '../../types';
import './roadmap.css';

interface Props {
  plan: Plan;
  tasks: Task[];
}

export default function PlanStats({ plan, tasks }: Props) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  const start = new Date(plan.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const end = new Date(plan.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="plan-stats">
        <div className="plan-stat">
          <div className="plan-stat-label">Progress</div>
          <div className="plan-stat-value">{done} / {total}</div>
          <div className="plan-progress-bar">
            <div className="plan-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="plan-stat">
          <div className="plan-stat-label">Duration</div>
          <div className="plan-stat-value" style={{ fontSize: 16 }}>{start} → {end}</div>
        </div>
        <div className="plan-stat">
          <div className="plan-stat-label">Source</div>
          <div className="plan-stat-value" style={{ fontSize: 16, textTransform: 'capitalize' }}>{plan.source}</div>
        </div>
      </div>
    </div>
  );
}
