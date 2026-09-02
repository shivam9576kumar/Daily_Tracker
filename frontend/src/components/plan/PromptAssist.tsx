import { useState } from 'react';
import Button from '../common/Button';
import './plan.css';

interface Props {
  onParse: (prompt: string) => Promise<void>;
  loading: boolean;
}

export default function PromptAssist({ onParse, loading }: Props) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    await onParse(prompt.trim());
  };

  return (
    <div className="ai-assist-box">
      <div className="ai-assist-title">
        <span>✨ Describe your goal with AI Assist</span>
      </div>
      <form className="ai-assist-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="ai-assist-input"
          placeholder="e.g. I want to finish NeetCode in 14 days, moderate pace, weak in Binary Search, exam on 10 Sept..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <Button type="submit" loading={loading} disabled={!prompt.trim() || loading}>
          ✨ Use AI Assist
        </Button>
      </form>
    </div>
  );
}
