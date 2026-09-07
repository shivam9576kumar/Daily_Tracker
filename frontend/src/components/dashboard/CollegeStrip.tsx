import { useState } from 'react';
import type { Assignment, ClassRow } from '../../types';

export default function CollegeStrip({
  classes,
  assignments,
}: {
  classes: ClassRow[];
  assignments: Assignment[];
}) {
  const [open, setOpen] = useState(false);
  const hasCollege = classes.length > 0 || assignments.length > 0;

  if (!hasCollege) return null;

  return (
    <section className="college-strip card">
      <button
        type="button"
        className="college-strip__head"
        onClick={() => setOpen((o) => !o)}
      >
        <span>🎓 Today's college</span>
        <span className="pill pill-count">
          {classes.length > 0 ? `${classes.length} classes` : ''}
          {classes.length > 0 && assignments.length > 0 ? ' · ' : ''}
          {assignments.length > 0 ? `${assignments.length} assignments` : ''}
        </span>
      </button>
      {open && (
        <div className="college-strip__body">
          {classes.map((c) => (
            <div key={c.id} className="college-strip__row">
              <span>{c.subject}</span>
              <span className="mono muted">{c.startTime}–{c.endTime}</span>
            </div>
          ))}
          {assignments.map((a) => (
            <div key={a.id} className="college-strip__row">
              <span>{a.title}</span>
              <span className="muted">
                {new Date(a.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
