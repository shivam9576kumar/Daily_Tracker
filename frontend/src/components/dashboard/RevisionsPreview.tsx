import { useState } from 'react';
import type { Task } from '../../types';
import { formatKey } from '../../utils/dateKeys';

export default function RevisionsPreview({ revisions }: { revisions: Task[] }) {
  const [open, setOpen] = useState(false);

  if (revisions.length === 0) return null;

  return (
    <section className="revisions-preview card">
      <button
        type="button"
        className="revisions-preview__head"
        onClick={() => setOpen((o) => !o)}
      >
        <span>🔁 Upcoming revisions</span>
        <span className="pill pill-count">{revisions.length}</span>
      </button>
      {open && (
        <div className="revisions-preview__body">
          {revisions.map((r) => (
            <div key={r.id} className="revisions-preview__row">
              <span className="mono">Rev #{r.revisionNumber}</span>
              <span>{r.title}</span>
              <span className="muted">
                {r.scheduledDateKey ? formatKey(r.scheduledDateKey, { day: 'numeric', month: 'short' }) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
