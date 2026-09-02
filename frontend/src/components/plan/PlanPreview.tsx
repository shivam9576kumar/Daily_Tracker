import Button from '../common/Button';
import type { PlanPreviewData } from '../../types';
import './plan.css';

interface Props {
  preview: PlanPreviewData;
  onCommit: (archiveExisting?: boolean) => Promise<void>;
  committing: boolean;
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function PlanPreview({ preview, onCommit, committing }: Props) {
  const { summary, days, warnings, errors, valid } = preview;

  return (
    <div className="wizard-card">
      <div className="wizard-section-title">
        <span>📊 Step 5: Schedule Preview & Confirmation</span>
      </div>

      {errors.length > 0 && (
        <div className="plan-alert error">
          <strong>⚠️ Errors:</strong>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="plan-alert warning">
          <strong>💡 Notes & Warnings:</strong>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="preview-summary-grid">
        <div className="preview-stat-card">
          <div className="preview-stat-val">{summary.totalQuestions}</div>
          <div className="preview-stat-lbl">Questions</div>
        </div>

        <div className="preview-stat-card">
          <div className="preview-stat-val">{summary.totalLoad}</div>
          <div className="preview-stat-lbl">Total Load</div>
        </div>

        <div className="preview-stat-card">
          <div className="preview-stat-val">{summary.durationDays}d</div>
          <div className="preview-stat-lbl">Duration</div>
        </div>

        <div className="preview-stat-card">
          <div className="preview-stat-val">{summary.estimatedQuestionsPerDay}</div>
          <div className="preview-stat-lbl">Avg / Day</div>
        </div>

        <div className="preview-stat-card">
          <div className="preview-stat-val">{summary.weekdayLoad}</div>
          <div className="preview-stat-lbl">Weekday Load</div>
        </div>

        <div className="preview-stat-card">
          <div className="preview-stat-val">{summary.weekendLoad}</div>
          <div className="preview-stat-lbl">Weekend Load</div>
        </div>
      </div>

      <div className="schedule-days-list">
        {days.map((day) => (
          <div key={day.date} className="schedule-day-card">
            <div className="schedule-day-header">
              <div className="schedule-day-date">
                <span>{formatDateHeader(day.date)}</span>
                {day.isBufferDay && (
                  <span className="tag tag-platform">Buffer Day</span>
                )}
                {day.busyReason && (
                  <span className="tag tag-backlog">{day.busyReason}</span>
                )}
              </div>
              <div className="schedule-day-load">
                Load: {day.usedLoad} / {day.capacityLoad}
              </div>
            </div>

            {day.questions.length > 0 ? (
              <div className="schedule-day-questions">
                {day.questions.map((q) => (
                  <div key={q.question.id} className="schedule-q-row">
                    <span className="schedule-q-title">{q.question.title}</span>
                    <div className="schedule-q-meta">
                      <span className="tag tag-topic">{q.question.topic}</span>
                      <span className={`tag tag-${q.question.difficulty}`}>
                        {q.question.difficulty} ({q.load})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: '#6b7280', fontStyle: 'italic' }}>
                No questions scheduled (catch-up / buffer day)
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          size="lg"
          loading={committing}
          disabled={!valid || committing}
          onClick={() => onCommit(false)}
        >
          🚀 Create This Plan
        </Button>
      </div>
    </div>
  );
}
