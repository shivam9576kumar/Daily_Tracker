import { useState } from 'react';
import { planApi } from '../../services/planApi';
import type {
  AIChatMessage,
  AIDraft,
  GeneratePlanPayload,
  PlanSource,
  AIIntent,
} from '../../types';

interface Props {
  onGeneratePreview: (payload: GeneratePlanPayload) => void;
  onCommit: () => void;
  onTweakManually: (draft: AIDraft) => void;
  canCommit: boolean;        // true only after a preview is loaded
  previewLoaded: boolean;    // drives the "Create Plan" button
}

export default function AIPlanChat({
  onGeneratePreview,
  onCommit,
  onTweakManually,
  canCommit,
  previewLoaded,
}: Props) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [draft, setDraft] = useState<AIDraft | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  const buildPayload = (): GeneratePlanPayload => {
    const today = new Date().toISOString().split('T')[0];
    return {
      source: (draft?.source as PlanSource) || 'neetcode150',
      startDate: draft?.startDate || today,
      durationDays: draft?.durationDays || 30,
      pace: (draft?.pace as any) || 'moderate',
      weekdayLoad: draft?.weekdayLoad ?? 2,
      weekendLoad: draft?.weekendLoad ?? 3,
      topicQuotas: draft?.topicQuotas ?? undefined,
      focusTopics: draft?.focusTopics ?? undefined,
      avoidTopics: draft?.avoidTopics ?? undefined,
      busyDays: draft?.busyDays ?? [],
    };
  };

  const actOnIntent = (intent: AIIntent) => {
    if (intent === 'request_commit' && canCommit) {
      onCommit();
    } else if (intent === 'request_preview' || (intent === 'request_commit' && !canCommit)) {
      onGeneratePreview(buildPayload());
    }
  };

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
      // Show the REAL AI reply — never a hardcoded menu.
      setMessages([...newMessages, { role: 'assistant', content: res.reply }]);
      actOnIntent(res.intent);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat card">
      <div className="ai-chat__messages">
        {messages.length === 0 && (
          <div className="ai-chat__bubble ai-chat__bubble--assistant">
            Hi! Tell me what you want to study. Example: “10 Stack, 10 Heap, 10 Queue from Coder Army in 15 days.”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-chat__bubble ai-chat__bubble--${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="ai-chat__bubble ai-chat__bubble--assistant">Thinking…</div>}
      </div>

      <div className="ai-chat__input-row">
        <input
          className="field ai-chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Type your message…"
          disabled={loading}
        />
        <button className="btn-primary" onClick={send} disabled={loading}>
          Send
        </button>
      </div>

      {done && draft && (
        <div className="ai-draft-summary card">
          <h3>Plan draft</h3>
          <p>
            <strong>Source:</strong>{' '}
            {draft.source === 'coderarmy'
              ? 'Coder Army Sheet'
              : draft.source === 'neetcode150'
              ? 'NeetCode 150'
              : '—'}
          </p>
          <p>
            <strong>Start:</strong> {draft.startDate || '—'} · <strong>Duration:</strong>{' '}
            {draft.durationDays ? `${draft.durationDays} days` : '—'}
          </p>
          {draft.topicQuotas?.length ? (
            <p>
              <strong>Topics:</strong>{' '}
              {draft.topicQuotas.map((q) => `${q.topic} ${q.count}`).join(' · ')}
            </p>
          ) : draft.focusTopics?.length ? (
            <p>
              <strong>Focus:</strong> {draft.focusTopics.join(', ')}
            </p>
          ) : null}
          {draft.busyDays?.length ? (
            <p>
              <strong>Busy days:</strong> {draft.busyDays.map((d) => d.date).join(', ')}
            </p>
          ) : null}

          <div className="ai-draft-summary__actions">
            <button className="btn-primary" onClick={() => onGeneratePreview(buildPayload())}>
              🚀 Generate Preview
            </button>
            {previewLoaded && (
              <button className="btn-primary" onClick={onCommit}>
                ✅ Create Plan
              </button>
            )}
            <button className="btn-secondary" onClick={() => onTweakManually(draft)}>
              🔧 Edit Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
