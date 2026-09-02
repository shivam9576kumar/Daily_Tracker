import './plan.css';

interface Props {
  source: string;
  onChange: (source: 'neetcode150') => void;
}

export default function StepSourceSelect({ source, onChange }: Props) {
  return (
    <div className="wizard-card">
      <div className="wizard-section-title">
        <span>📚 Step 1: Select Question Source</span>
      </div>
      <div className="pace-cards">
        <div
          className={`pace-card ${source === 'neetcode150' ? 'active' : ''}`}
          onClick={() => onChange('neetcode150')}
        >
          <div className="pace-card-title">🚀 NeetCode 150 Sample</div>
          <div className="pace-card-desc">
            20 essential curated DSA patterns (Arrays, Two Pointers, Trees, Sliding Window, DP, etc.)
          </div>
        </div>
      </div>
    </div>
  );
}
