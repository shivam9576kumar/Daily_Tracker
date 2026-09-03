import type { ArchivedPlan } from '../../types';
import Button from '../common/Button';
import './roadmap.css';

interface Props {
  plans: ArchivedPlan[];
  busyId?: string | null;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ArchivedPlansList({ plans, busyId, onRestore, onDelete }: Props) {
  if (plans.length === 0) return null;

  return (
    <section className="archived-section">
      <div className="archived-title">Your archived plans — restore anytime</div>
      {plans.map((p) => (
        <div key={p.id} className="archived-card">
          <div>
            <div className="archived-name">{p.name}</div>
            <div className="archived-meta">
              {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {p.progress.solved}/{p.progress.total} solved · {p.progress.revPending} rev pending · {p.source}
            </div>
          </div>
          <div className="archived-btns">
            <Button size="sm" variant="secondary" disabled={busyId === p.id} onClick={() => onRestore(p.id)}>Restore</Button>
            <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => onDelete(p.id)}>Delete</Button>
          </div>
        </div>
      ))}
    </section>
  );
}
