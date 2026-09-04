import type { ArchivedPlan } from '../../types';
import { SOURCE_LABEL } from '../../utils/labels';
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
    <section className="card archived">
      <div className="archived__head">
        <h2 className="t-h2">Archived plans</h2>
        <span className="pill pill-count">{plans.length}</span>
      </div>
      {plans.map((p) => (
        <div key={p.id} className="archived__row">
          <div className="archived__text">
            <span className="t-title">{p.name}</span>
            <div className="t-meta archived__meta">
              {SOURCE_LABEL[p.source] ?? p.source} · {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {p.progress.solved}/{p.progress.total} solved
            </div>
          </div>
          <div className="archived__actions">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={busyId === p.id}
              onClick={() => onRestore(p.id)}
            >
              Restore
            </button>
            <button
              type="button"
              className="t-link is-danger"
              disabled={busyId === p.id}
              onClick={() => onDelete(p.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
