import type { TopicProgressData } from '../../types';
import CircularProgress from '../common/CircularProgress';
import './progress.css';

interface Props {
  data: TopicProgressData;
  onScopeChange: (scope: 'plan' | 'all') => void;
}

export default function TopicProgress({ data, onScopeChange }: Props) {
  const subtitle =
    data.scope === 'plan' && data.planName
      ? data.planName
      : 'All problems';

  return (
    <section className="progress-card topic-card">
      <div className="progress-card__header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <h2 className="progress-card__heading">Topic Mastery</h2>
        <div className="topic-card__subtitle">{subtitle}</div>

        {data.hasActivePlan && (
          <div className="progress-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={data.scope === 'plan'}
              className={`progress-tab ${data.scope === 'plan' ? 'is-active' : ''}`}
              onClick={() => onScopeChange('plan')}
            >
              This Plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={data.scope === 'all'}
              className={`progress-tab ${data.scope === 'all' ? 'is-active' : ''}`}
              onClick={() => onScopeChange('all')}
            >
              All
            </button>
          </div>
        )}
      </div>

      {data.topics.length === 0 ? (
        <div className="progress-empty">
          No problems yet. Generate a plan or add a task to see topics here.
        </div>
      ) : (
        <div className="topic-grid">
          {data.topics.map((t) => (
            <div className="topic-item topic-item--circular" key={t.topic}>
              <CircularProgress
                percentage={t.percent}
                size={68}
                strokeWidth={6}
                color={t.percent >= 100 ? 'var(--success)' : 'var(--brand)'}
                trackColor="var(--border)"
              />
              <div className="topic-item__info">
                <span className="topic-item__name">{t.topic}</span>
                <span className="topic-item__count">{t.solved} / {t.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
