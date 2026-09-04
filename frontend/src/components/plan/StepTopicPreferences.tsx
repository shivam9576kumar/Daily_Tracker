import './plan.css';

interface Props {
  focusTopics: string[];
  avoidTopics: string[];
  onChange: (focus: string[], avoid: string[]) => void;
}

const AVAILABLE_TOPICS = [
  'Arrays',
  'Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Linked List',
  'Trees',
  'Heap',
  'Stack',
  'Queue',
  'Dynamic Programming',
  'Graphs',
];

export default function StepTopicPreferences({
  focusTopics,
  avoidTopics,
  onChange,
}: Props) {
  const toggleFocus = (topic: string) => {
    let nextFocus = [...focusTopics];
    let nextAvoid = avoidTopics.filter((t) => t.toLowerCase() !== topic.toLowerCase());

    if (nextFocus.some((t) => t.toLowerCase() === topic.toLowerCase())) {
      nextFocus = nextFocus.filter((t) => t.toLowerCase() !== topic.toLowerCase());
    } else {
      nextFocus.push(topic);
    }
    onChange(nextFocus, nextAvoid);
  };

  const toggleAvoid = (topic: string) => {
    let nextAvoid = [...avoidTopics];
    let nextFocus = focusTopics.filter((t) => t.toLowerCase() !== topic.toLowerCase());

    if (nextAvoid.some((t) => t.toLowerCase() === topic.toLowerCase())) {
      nextAvoid = nextAvoid.filter((t) => t.toLowerCase() !== topic.toLowerCase());
    } else {
      nextAvoid.push(topic);
    }
    onChange(nextFocus, nextAvoid);
  };

  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 3 of 5</div>
      <h2 className="step-card__heading">Topic Priorities & Exclusions</h2>
      <p className="step-card__hint">
        Focus topics will be scheduled earlier; avoided topics will be deprioritized or excluded.
      </p>

      <div className="topic-group">
        <div className="topic-group__head">
          <span className="topic-group__label">Focus topics</span>
          <span className="topic-group__hint">(Prioritized earlier in the schedule)</span>
        </div>
        <div className="chip-cloud">
          {AVAILABLE_TOPICS.map((topic) => {
            const isSelected = focusTopics.some(
              (t) => t.toLowerCase() === topic.toLowerCase()
            );
            return (
              <button
                key={`focus-${topic}`}
                type="button"
                className={`chip${isSelected ? ' is-on' : ''}`}
                aria-pressed={isSelected}
                onClick={() => toggleFocus(topic)}
              >
                {isSelected ? '✓ ' : '+ '}
                {topic}
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
          {AVAILABLE_TOPICS.map((topic) => {
            const isSelected = avoidTopics.some(
              (t) => t.toLowerCase() === topic.toLowerCase()
            );
            return (
              <button
                key={`avoid-${topic}`}
                type="button"
                className={`chip${isSelected ? ' is-avoid' : ''}`}
                aria-pressed={isSelected}
                onClick={() => toggleAvoid(topic)}
              >
                {isSelected ? '✕ ' : ''}
                {topic}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
