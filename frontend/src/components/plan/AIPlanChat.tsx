import { useState } from 'react';
import { planApi } from '../../services/planApi';
import type { AIChatMessage, AIDraft, GeneratePlanPayload, PlanSource } from '../../types';

interface Props {
  onGeneratePreview: (payload: GeneratePlanPayload) => void;
  onTweakManually: (draft: AIDraft) => void;
}

export default function AIPlanChat({ onGeneratePreview, onTweakManually }: Props) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [draft, setDraft] = useState<AIDraft | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: AIChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await planApi.aiConversation({
        messages: newMessages,
        draft: draft ?? ({} as AIDraft),
      });
      setDraft(res.draft);
      setDone(res.done);
      if (res.question) {
        setMessages([...newMessages, { role: 'assistant', content: res.question }]);
      }
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = (): GeneratePlanPayload => {
    const today = new Date().toISOString().split('T')[0];
    if (!draft) {
      return {
        source: 'neetcode150',
        startDate: today,
        durationDays: 30,
        pace: 'moderate',
        weekdayLoad: 2,
        weekendLoad: 3,
        focusTopics: [],
        avoidTopics: [],
        busyDays: [],
      };
    }
    return {
      source: (draft.source as PlanSource) || 'neetcode150',
      startDate: draft.startDate || today,
      durationDays: draft.durationDays || 30,
      pace: draft.pace || 'moderate',
      weekdayLoad: draft.weekdayLoad ?? 2,
      weekendLoad: draft.weekendLoad ?? 3,
      topicQuotas: draft.topicQuotas ?? undefined,
      focusTopics: draft.focusTopics ?? undefined,
      avoidTopics: draft.avoidTopics ?? undefined,
      busyDays: draft.busyDays ?? [],
    };
  };

  return (
    <div className="ai-chat card">
      <div className="ai-chat__messages">
        {messages.length === 0 && (
          <p className="ai-chat__greeting">
            Tell me what you want to study. Example: "10 Stack, 10 Heap, 10 Queue from CoderArmy in 15 days."
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-chat__bubble ai-chat__bubble--${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="ai-chat__bubble ai-chat__bubble--assistant">Thinking...</div>}
      </div>

      <div className="ai-chat__input-row">
        <input
          className="field ai-chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Type your goal..."
          disabled={loading}
        />
        <button className="btn-primary" onClick={send} disabled={loading}>
          Send
        </button>
      </div>

      {done && draft && (
        <div className="ai-draft-summary card">
          <h3>Draft plan</h3>
          <p>
            <strong>Source:</strong>{' '}
            {draft.source === 'coderarmy'
              ? 'Coder Army Sheet'
              : draft.source === 'neetcode150'
              ? 'NeetCode 150'
              : '—'}
          </p>
          <p>
            <strong>Start:</strong> {draft.startDate || '—'}
          </p>
          <p>
            <strong>Duration:</strong> {draft.durationDays ? `${draft.durationDays} days` : '—'}
          </p>
          {draft.topicQuotas && draft.topicQuotas.length > 0 ? (
            <p>
              <strong>Topic counts:</strong>{' '}
              {draft.topicQuotas.map((q) => `${q.topic}: ${q.count}`).join(', ')}
            </p>
          ) : draft.focusTopics && draft.focusTopics.length > 0 ? (
            <p>
              <strong>Focus topics:</strong> {draft.focusTopics.join(', ')}
            </p>
          ) : null}
          {draft.busyDays && draft.busyDays.length > 0 && (
            <p>
              <strong>Busy days:</strong> {draft.busyDays.map((d) => d.date).join(', ')}
            </p>
          )}
          <div className="ai-draft-summary__actions">
            <button className="btn-primary" onClick={() => onGeneratePreview(buildPayload())}>
              🚀 Generate Preview
            </button>
            <button className="btn-secondary" onClick={() => onTweakManually(draft)}>
              🔧 Tweak Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
