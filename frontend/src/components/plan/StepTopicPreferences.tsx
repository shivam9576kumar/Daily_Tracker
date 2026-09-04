import { useState, useEffect } from 'react';
import type { ScheduleMode } from '../../types';
import { planApi } from '../../services/planApi';
import './plan.css';

interface Props {
  source: string;
  scheduleMode: ScheduleMode;
  orderedTopics: string[];
  focusTopics: string[];
  avoidTopics: string[];
  onModeChange: (mode: ScheduleMode) => void;
  onOrderedTopicsChange: (topics: string[]) => void;
  onFocusAvoidChange: (focus: string[], avoid: string[]) => void;
}

export default function StepTopicPreferences({
  source,
  scheduleMode,
  orderedTopics,
  focusTopics,
  avoidTopics,
  onModeChange,
  onOrderedTopicsChange,
  onFocusAvoidChange,
}: Props) {
  const [bankTopics, setBankTopics] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    planApi
      .getTopics(source)
      .then((res) => {
        setBankTopics(res.topics || []);
        setLoading(false);
      })
      .catch(() => {
        setBankTopics([]);
        setLoading(false);
        setLoadError(true);
      });
  }, [source]);

  const toggleFocus = (topicName: string) => {
    let nextFocus = [...focusTopics];
    let nextAvoid = avoidTopics.filter((t) => t.toLowerCase() !== topicName.toLowerCase());

    if (nextFocus.some((t) => t.toLowerCase() === topicName.toLowerCase())) {
      nextFocus = nextFocus.filter((t) => t.toLowerCase() !== topicName.toLowerCase());
    } else {
      nextFocus.push(topicName);
    }
    onFocusAvoidChange(nextFocus, nextAvoid);
  };

  const toggleAvoid = (topicName: string) => {
    let nextAvoid = [...avoidTopics];
    let nextFocus = focusTopics.filter((t) => t.toLowerCase() !== topicName.toLowerCase());

    if (nextAvoid.some((t) => t.toLowerCase() === topicName.toLowerCase())) {
      nextAvoid = nextAvoid.filter((t) => t.toLowerCase() !== topicName.toLowerCase());
    } else {
      nextAvoid.push(topicName);
    }
    onFocusAvoidChange(nextFocus, nextAvoid);
  };

  const addTopic = (t: string) => {
    if (!orderedTopics.includes(t)) {
      onOrderedTopicsChange([...orderedTopics, t]);
    }
  };

  const removeTopic = (t: string) => {
    onOrderedTopicsChange(orderedTopics.filter((x) => x !== t));
  };

  const moveUp = (i: number) => {
    if (i <= 0) return;
    const next = [...orderedTopics];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onOrderedTopicsChange(next);
  };

  const moveDown = (i: number) => {
    if (i >= orderedTopics.length - 1) return;
    const next = [...orderedTopics];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    onOrderedTopicsChange(next);
  };

  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 3 of 5</div>
      <h2 className="step-card__heading">Topic Priorities &amp; Exclusions</h2>
      <p className="step-card__hint">Choose how topics are ordered across your plan.</p>

      {/* Mode toggle */}
      <div className="topic-mode" role="radiogroup" aria-label="Scheduling order">
        <button
          type="button"
          className={`topic-mode__btn ${scheduleMode === 'balanced' ? 'is-active' : ''}`}
          aria-pressed={scheduleMode === 'balanced'}
          onClick={() => onModeChange('balanced')}
        >
          Balanced
          <span className="topic-mode__desc">Mix topics across days (better revision spread)</span>
        </button>
        <button
          type="button"
          className={`topic-mode__btn ${scheduleMode === 'sequential' ? 'is-active' : ''}`}
          aria-pressed={scheduleMode === 'sequential'}
          onClick={() => onModeChange('sequential')}
        >
          Sequential
          <span className="topic-mode__desc">Finish each topic fully before the next</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading topics from question bank...
        </div>
      ) : loadError ? (
        <div style={{ padding: '16px 0', color: '#ef4444', fontSize: 14 }}>
          Could not load topics.
        </div>
      ) : scheduleMode === 'balanced' ? (
        <>
          <div className="topic-group">
            <div className="topic-group__head">
              <span className="topic-group__label">Focus topics</span>
              <span className="topic-group__hint">(Prioritized earlier in the schedule)</span>
            </div>
            <div className="chip-cloud">
              {bankTopics.map((topic) => {
                const isSelected = focusTopics.some(
                  (t) => t.toLowerCase() === topic.name.toLowerCase()
                );
                return (
                  <button
                    key={`focus-${topic.name}`}
                    type="button"
                    className={`chip${isSelected ? ' is-on' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleFocus(topic.name)}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {topic.name} <span className="chip__count">{topic.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="topic-group">
            <div className="topic-group__head">
              <span className="topic-group__label">Avoid topics</span>
              <span className="topic-group__hint">(Deprioritized or excluded)</span>
            </div>
            <div className="chip-cloud">
              {bankTopics.map((topic) => {
                const isSelected = avoidTopics.some(
                  (t) => t.toLowerCase() === topic.name.toLowerCase()
                );
                return (
                  <button
                    key={`avoid-${topic.name}`}
                    type="button"
                    className={`chip${isSelected ? ' is-avoid' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleAvoid(topic.name)}
                  >
                    {isSelected ? '✕ ' : ''}
                    {topic.name} <span className="chip__count">{topic.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="topic-order">
            <div className="topic-order__label t-label">
              Topic order (top = scheduled first)
            </div>

            {orderedTopics.length === 0 ? (
              <div className="topic-order__empty t-body">
                Add topics below. All questions of topic #1 come first, then #2, then #3.
              </div>
            ) : (
              <ol className="topic-order__list">
                {orderedTopics.map((t, i) => (
                  <li key={t} className="topic-order__item">
                    <span className="topic-order__num">{i + 1}</span>
                    <span className="topic-order__name">{t}</span>
                    <div className="topic-order__controls">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${t} up`}
                        disabled={i === 0}
                        onClick={() => moveUp(i)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${t} down`}
                        disabled={i === orderedTopics.length - 1}
                        onClick={() => moveDown(i)}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="icon-btn is-danger"
                        aria-label={`Remove ${t}`}
                        onClick={() => removeTopic(t)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="topic-pool">
            <div className="topic-pool__label t-label">Add topic</div>
            <div className="chip-cloud">
              {bankTopics
                .filter((t) => !orderedTopics.includes(t.name))
                .map((topic) => (
                  <button
                    key={`pool-${topic.name}`}
                    type="button"
                    className="chip"
                    onClick={() => addTopic(topic.name)}
                  >
                    + {topic.name} <span className="chip__count">{topic.count}</span>
                  </button>
                ))}
            </div>
          </div>

          <div className="topic-group" style={{ marginTop: 20 }}>
            <div className="topic-group__head">
              <span className="topic-group__label">Avoid topics</span>
              <span className="topic-group__hint">(Deprioritized or excluded)</span>
            </div>
            <div className="chip-cloud">
              {bankTopics.map((topic) => {
                const isSelected = avoidTopics.some(
                  (t) => t.toLowerCase() === topic.name.toLowerCase()
                );
                return (
                  <button
                    key={`avoid-${topic.name}`}
                    type="button"
                    className={`chip${isSelected ? ' is-avoid' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleAvoid(topic.name)}
                  >
                    {isSelected ? '✕ ' : ''}
                    {topic.name} <span className="chip__count">{topic.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="topic-order__note t-meta">
            Sequential groups a topic together. Revisions still spread out automatically
            at +1/+3/+7/+14 days.
          </p>
        </>
      )}
    </section>
  );
}
