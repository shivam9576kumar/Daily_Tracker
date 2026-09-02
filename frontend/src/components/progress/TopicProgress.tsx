import type { TopicProgressData } from '../../types';
import TopicProgressCircle from './TopicProgressCircle';
import './progress.css';

interface Props {
  data: TopicProgressData;
  onScopeChange: (scope: 'plan' | 'all') => void;
}

export default function TopicProgress({ data, onScopeChange }: Props) {
  const title =
    data.scope === 'plan' && data.planName
      ? `Topic mastery · ${data.planName}`
      : 'Topic mastery · all problems';

  return (
    <section className="pcard">
      <div className="pcard-head">
        <h3 className="pcard-title">{title}</h3>
        {data.hasActivePlan && (
          <div className="scope-toggle">
            <button
              className={`scope-btn ${data.scope === 'plan' ? 'active' : ''}`}
              onClick={() => onScopeChange('plan')}
            >
              This plan
            </button>
            <button
              className={`scope-btn ${data.scope === 'all' ? 'active' : ''}`}
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
            <TopicProgressCircle key={t.topic} {...t} />
          ))}
        </div>
      )}
    </section>
  );
}
