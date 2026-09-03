import type { Plan, Task } from '../../types';
import './roadmap.css';

interface Props {
  plan: Plan;
  tasks: Task[];       // plan problems only
  revisions: Task[];   // all revisions
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function PlanStats({ plan, tasks, revisions }: Props) {
  // Problems only — revisions must never inflate the plan's denominator
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const revPending = revisions.filter((r) => r.status !== 'completed').length;
  const revDone = revisions.length - revPending;

  return (
    <div className="plan-stats">
      <div className="plan-stat">
        <div className="plan-stat-label">Problems</div>
        <div className="plan-stat-value">{done} / {total}</div>
        <div className="plan-progress-bar">
          <div className="plan-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="plan-stat">
        <div className="plan-stat-label">Revisions</div>
        <div className="plan-stat-value" style={{ color: '#d8b4fe' }}>{revPending}</div>
        <div className="plan-stat-sub">upcoming · {revDone} done</div>
      </div>

      <div className="plan-stat">
        <div className="plan-stat-label">Duration</div>
        <div className="plan-stat-value" style={{ fontSize: 16 }}>
          {fmt(plan.startDate)} → {fmt(plan.endDate)}
        </div>
      </div>

      <div className="plan-stat">
        <div className="plan-stat-label">Source</div>
        <div className="plan-stat-value" style={{ fontSize: 16, textTransform: 'capitalize' }}>
          {plan.source}
        </div>
      </div>
    </div>
  );
}
