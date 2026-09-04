import type { Plan, Task } from '../../types';
import { SOURCE_LABEL } from '../../utils/labels';
import './roadmap.css';

interface Props {
  plan: Plan;
  tasks: Task[];       // plan problems only
  revisions: Task[];   // all revisions
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function PlanStats({ plan, tasks, revisions }: Props) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'completed').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const revTotal = revisions.length;
  const revUpcoming = revisions.filter((r) => r.status !== 'completed').length;
  const revDone = revTotal - revUpcoming;

  const start = new Date(plan.startDate).setHours(0, 0, 0, 0);
  const end = new Date(plan.endDate).setHours(0, 0, 0, 0);
  const now = new Date().setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const dayIndex = Math.min(totalDays, Math.max(1, Math.round((now - start) / 86400000) + 1));

  return (
    <section className="card plan-stats">
      <div className="plan-stat">
        <span className="t-label">Problems</span>
        <div className="plan-stat__value">
          <span className="t-stat-sm">{done}</span>
          <span className="plan-stat__of">/ {total}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`progress__fill${pct >= 100 ? ' is-success' : ''}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="plan-stat">
        <span className="t-label">Revisions</span>
        <span className="t-stat-sm">{revTotal}</span>
        <span className="t-meta plan-stat__sub">{revUpcoming} upcoming · {revDone} done</span>
      </div>

      <div className="plan-stat">
        <span className="t-label">Duration</span>
        <span className="t-title num">{fmtDate(plan.startDate)} → {fmtDate(plan.endDate)}</span>
        <span className="t-meta plan-stat__sub">Day {dayIndex} of {totalDays}</span>
      </div>

      <div className="plan-stat">
        <span className="t-label">Source</span>
        <span className="t-title">{SOURCE_LABEL[plan.source] ?? plan.source}</span>
        {plan.weekdayCapacity != null && (
          <span className="t-meta plan-stat__sub">
            {plan.weekdayCapacity}/day weekdays · {plan.weekendCapacity}/day weekends
          </span>
        )}
      </div>
    </section>
  );
}
