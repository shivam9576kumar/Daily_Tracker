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
    <div className="wizard-card">
      <div className="wizard-section-title">
        <span>🎯 Step 3: Topic Priorities & Exclusions</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#d8b4fe', marginBottom: 8 }}>
          ⭐ Focus Topics (Prioritized earlier in the schedule)
        </div>
        <div className="topic-chips">
          {AVAILABLE_TOPICS.map((topic) => {
            const isSelected = focusTopics.some(
              (t) => t.toLowerCase() === topic.toLowerCase()
            );
            return (
              <div
                key={`focus-${topic}`}
                className={`topic-chip ${isSelected ? 'selected-focus' : ''}`}
                onClick={() => toggleFocus(topic)}
              >
                {isSelected ? '✓ ' : '+ '}
                {topic}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', marginBottom: 8 }}>
          🚫 Avoid / Deprioritize Topics
        </div>
        <div className="topic-chips">
          {AVAILABLE_TOPICS.map((topic) => {
            const isSelected = avoidTopics.some(
              (t) => t.toLowerCase() === topic.toLowerCase()
            );
            return (
              <div
                key={`avoid-${topic}`}
                className={`topic-chip ${isSelected ? 'selected-avoid' : ''}`}
                onClick={() => toggleAvoid(topic)}
              >
                {isSelected ? '✕ ' : ''}
                {topic}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
