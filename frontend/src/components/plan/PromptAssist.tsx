import { useState } from 'react';
import './plan.css';

interface Props {
  onParse: (prompt: string) => Promise<void>;
  loading: boolean;
}

export default function PromptAssist({ onParse, loading }: Props) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;
    await onParse(prompt.trim());
  };

  return (
    <section className="card ai-assist">
      <div className="ai-assist__head">
        <span aria-hidden="true">✨</span>
        <h2 className="ai-assist__title">Describe your goal with AI Assist</h2>
      </div>
      <div className="ai-assist__body">
        <textarea
          className="field ai-assist__input"
          rows={3}
          placeholder="e.g. I want to finish NeetCode in 14 days, moderate pace, weak in Binary Search, exam on 10 Sept…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <button
          type="button"
          className="btn-brand-outline ai-assist__btn"
          disabled={!prompt.trim() || loading}
          onClick={() => handleSubmit()}
        >
          {loading ? 'Analyzing...' : '✨ Use AI Assist'}
        </button>
      </div>
    </section>
  );
}
