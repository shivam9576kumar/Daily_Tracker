import type { PlanPreviewData } from '../../types';
import './plan.css';

interface Props {
  preview: PlanPreviewData;
  onCommit: (archiveExisting?: boolean) => Promise<void>;
  committing: boolean;
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
  });
}

export default function PlanPreview({ preview, onCommit, committing }: Props) {
  const { summary, days, warnings, errors, valid } = preview;
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 5 of 5</div>
      <h2 className="step-card__heading">Schedule Preview & Confirmation</h2>
      <p className="step-card__hint">
        Review your generated plan schedule below before creating your study plan.
      </p>

      {errors.length > 0 && (
        <div className="banner banner--danger">
          <strong>Errors:</strong>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="banner banner--warning">
          <strong>Notes & Warnings:</strong>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="preview-summary-strip">
        <span className="step-card__hint" style={{ margin: 0 }}>
          {summary.durationDays} days · {summary.totalQuestions} questions · starts {days[0]?.date}
        </span>
        <div className="preview-chips">
          <span className="pill pill-count">{summary.durationDays} days</span>
          <span className="pill pill-count">{summary.totalQuestions} questions</span>
          <span className="pill pill-count">{summary.totalLoad} load</span>
          <span className="pill pill-count is-brand">~{summary.estimatedQuestionsPerDay} / day</span>
        </div>
      </div>

      <div className="preview-grid">
        {days.map((day) => {
          const isToday = day.date === todayStr;
          const isRest = day.isBufferDay && day.questions.length === 0;
          const isBusy = Boolean(day.busyReason);

          let dayClasses = 'pday';
          if (isToday) dayClasses += ' is-today';
          if (isBusy) dayClasses += ' is-busy';
          if (isRest) dayClasses += ' is-rest';

          return (
            <div key={day.date} className={dayClasses}>
              <div className="pday__head">
                <span className="pday__date">{formatDateHeader(day.date)}</span>
                <span className="pday__load">
                  {day.questions.length > 0 ? `${day.questions.length}q` : isRest ? 'Rest' : '0q'}
                </span>
              </div>

              {day.busyReason && (
                <span className="pill pill-warning" style={{ fontSize: 11, alignSelf: 'flex-start' }}>
                  {day.busyReason}
                </span>
              )}

              {day.questions.length > 0 ? (
                <div className="pday__questions">
                  {day.questions.slice(0, 2).map((q, idx) => {
                    const title = q.question?.title ?? q.title;
                    const difficulty = (q.question?.difficulty ?? q.difficulty ?? 'medium').toLowerCase();
                    const key = q.question?.id ?? `${title}-${idx}`;

                    return (
                      <div key={key} className="pday__q" title={title}>
                        <span className={`pday__q-dot is-${difficulty}`} aria-hidden="true" />
                        <span>{title}</span>
                      </div>
                    );
                  })}
                  {day.questions.length > 2 && (
                    <span className="pday__more">+{day.questions.length - 2} more</span>
                  )}
                </div>
              ) : isRest ? (
                <span className="pday__rest-text">Catch-up Day</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="step-foot">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ← Edit Settings
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!valid || committing}
          onClick={() => onCommit(false)}
        >
          {committing ? 'Generating...' : 'Generate Plan'}
        </button>
      </div>
    </section>
  );
}
