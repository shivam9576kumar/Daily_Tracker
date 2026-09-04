import { useState } from 'react';
import { planApi } from '../../services/planApi';
import {
  draftToPlanPayload,
  planPayloadFingerprint,
} from '../../utils/planDraft';
import ChatMarkdown from './ChatMarkdown';
import type {
  AIChatMessage,
  AIDraft,
  GeneratePlanPayload,
  AIAction,
} from '../../types';

interface Props {
  onGeneratePreview: (payload: GeneratePlanPayload) => Promise<void> | void;
  onCommit: () => Promise<void> | void;
  onTweakManually: (draft: AIDraft) => void;
  onPlanDraftChanged: (draft: AIDraft) => void;
  previewLoaded: boolean;
}

export default function AIPlanChat({
  onGeneratePreview,
  onCommit,
  onTweakManually,
  onPlanDraftChanged,
  previewLoaded,
}: Props) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [draft, setDraft] = useState<AIDraft | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [action, setAction] = useState<AIAction>('none');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);

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

      const previousPayload = draft
        ? draftToPlanPayload(draft)
        : null;

      const nextPayload = draftToPlanPayload(res.draft);

      const planChanged =
        !previousPayload ||
        planPayloadFingerprint(previousPayload) !==
          planPayloadFingerprint(nextPayload);

      if (
        planChanged &&
        (
          res.intent === 'plan_building' ||
          res.intent === 'request_preview' ||
          res.intent === 'request_commit'
        )
      ) {
        onPlanDraftChanged(res.draft);
      }

      setDraft(res.draft);
      setDone(res.done);
      setAction(res.action);
      setWarnings(res.warnings ?? []);
      setAssumptions(res.assumptions ?? []);

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: res.reply,
        },
      ]);
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
            {m.role === 'assistant'
              ? <ChatMarkdown text={m.content} />
              : m.content}
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

          {warnings.length > 0 && (
            <div className="banner banner--warning" style={{ marginTop: 8 }}>
              {warnings.map((w, i) => (
                <p key={i} style={{ margin: '2px 0' }}>{w}</p>
              ))}
            </div>
          )}

          {assumptions.length > 0 && (
            <div className="banner banner--warning" style={{ marginTop: 8 }}>
              {assumptions.map((a, i) => (
                <p key={i} style={{ margin: '2px 0' }}>{a}</p>
              ))}
            </div>
          )}

          <div className="ai-draft-summary__actions">
            {(action === 'show_draft' || action === 'offer_preview') && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onGeneratePreview(draftToPlanPayload(draft))}
              >
                🚀 Generate Preview
              </button>
            )}
            {previewLoaded && done && (
              <button type="button" className="btn-primary" onClick={onCommit}>
                ✅ Create Plan
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onTweakManually(draft)}
            >
              🔧 Edit Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

