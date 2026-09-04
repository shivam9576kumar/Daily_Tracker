# Complete Code Changes & Exact Code Written

This document contains the exact code written across all files for the **Real Conversational AI Plan Generator + `topicQuotas` Fixes & Refinements**.

---

## 1. `backend/src/services/ai/geminiPlanChat.ts`
**Link**: [`geminiPlanChat.ts`](file:///c:/Users/shiva/Daily_Tracker/backend/src/services/ai/geminiPlanChat.ts)

Added `AIAction`, `warnings`, `assumptions`, `computeAction`, and trusted `today` in `extractPatch`:

```ts
import { env } from '../../config/env';
import { geminiGenerate } from '../../utils/geminiClient';
import logger from '../../utils/logger';
import { loadQuestionBank, getAvailableTopics } from '../plan/questionBankLoader';
import { todayKey } from '../../utils/dateKeys';

export interface TopicQuota { topic: string; count: number; }
export interface BusyDayInput { date: string; reason?: string; loadReduction: number; }

export interface AIDraft {
  source?: string | null;
  startDate?: string | null;
  durationDays?: number | null;
  pace?: string | null;
  weekdayLoad?: number | null;
  weekendLoad?: number | null;
  topicQuotas?: TopicQuota[] | null;
  focusTopics?: string[] | null;
  avoidTopics?: string[] | null;
  busyDays?: BusyDayInput[] | null;
  bufferDay?: number | null;
}

export type AIIntent =
  | 'general_chat'
  | 'plan_building'
  | 'request_preview'
  | 'request_commit'
  | 'off_topic';

export type AIAction = 'none' | 'show_draft' | 'offer_preview';

export interface AIChatMessage { role: 'user' | 'assistant'; content: string; }

export interface AIConversationRequest {
  messages: AIChatMessage[];
  draft: AIDraft;
  timezone?: string;
}

export interface AIChatResponse {
  reply: string;            // ALWAYS the text shown in the chat bubble
  intent: AIIntent;
  action: AIAction;
  draft: AIDraft;
  missingFields: string[];  // computed by the app, not the model
  done: boolean;            // computed by the app
  confidence: 'high' | 'low';
  warnings: string[];
  assumptions: string[];
}

function computeAction(intent: AIIntent, done: boolean): AIAction {
  if (!done) return 'none';
  if (intent === 'request_preview') return 'offer_preview';
  if (intent === 'request_commit') return 'offer_preview'; // never commit from AI
  return 'show_draft';
}

export const geminiPlanChat = {
  async process(req: AIConversationRequest): Promise<AIChatResponse> {
    const { messages, draft } = req;
    const tz = req.timezone || env.DEFAULT_TIMEZONE || 'Asia/Kolkata';
    const meta = getBankMeta();
    const ctx = {
      today: todayKey(tz),
      timezone: tz,
      sources: meta.sources,
      topics: meta.topics,
      topicCounts: meta.counts,
    };

    if (!env.GEMINI_API_KEY) {
      return this.offlineReply(messages, draft, ctx);
    }

    const systemPrompt = buildSystemPrompt(ctx);
    const convo = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    const prompt = `${systemPrompt}\n\nCurrent draft:\n${JSON.stringify(draft)}\n\nConversation:\n${convo}\n\nRespond with JSON only.`;

    try {
      const raw = await geminiGenerate(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { temperature: 0.2, responseMimeType: 'application/json' }
      );
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : '';
      const intent = normalizeIntent(parsed.intent);
      const patch = sanitizePatch(parsed.draftPatch || parsed.draft || {});
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((x: any) => typeof x === 'string') : [];
      const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions.filter((x: any) => typeof x === 'string') : [];
      const merged = mergeDraft(draft, patch);
      const { missingFields, done } = computeMissing(merged);

      return {
        reply: reply || this.composeFallbackReply(merged, missingFields),
        intent,
        action: computeAction(intent, done),
        draft: merged,
        missingFields,
        done,
        confidence: 'high',
        warnings,
        assumptions,
      };
    } catch (err) {
      logger.error('geminiPlanChat: Gemini call failed, using offline fallback', err);
      return this.offlineReply(messages, draft, ctx);
    }
  },

  offlineReply(messages: AIChatMessage[], draft: AIDraft, ctx: { today: string }): AIChatResponse {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';

    const patch = this.extractPatch(text, ctx.today);
    const merged = mergeDraft(draft, patch);
    const { missingFields, done } = computeMissing(merged);

    const hasPlanSignal =
      /stack|heap|queue|array|graph|dp|binary search|neetcode|coder|sheet|plan|days|focus/i.test(text);

    let reply: string;
    let intent: AIIntent;
    if (!hasPlanSignal) {
      reply = `I'm running in offline mode (no AI key set), so I can't free-chat right now. Today is ${ctx.today}. Add GEMINI_API_KEY to enable conversation. Meanwhile, tell me your source, topics (or counts), and days to build a plan.`;
      intent = 'general_chat';
    } else {
      const got = [];
      if (merged.source) got.push(merged.source === 'coderarmy' ? 'Coder Army' : 'NeetCode 150');
      if (merged.topicQuotas?.length) got.push(merged.topicQuotas.map((q) => `${q.count} ${q.topic}`).join(', '));
      if (merged.focusTopics?.length) got.push('focus: ' + merged.focusTopics.join(', '));
      if (merged.durationDays) got.push(`${merged.durationDays} days`);
      const still = missingFields.length ? ` Still need: ${missingFields.join(', ')}.` : ' Ready to preview!';
      reply = `Offline mode (no AI key) — I can still build your plan. I read: ${got.join(', ') || 'nothing yet'}.${still}`;
      intent = 'plan_building';
    }

    return {
      reply,
      intent,
      action: done ? 'show_draft' : 'none',
      draft: merged,
      missingFields,
      done,
      confidence: 'low',
      warnings: [],
      assumptions: [],
    };
  },

  extractPatch(text: string, today: string): Partial<AIDraft> {
    const patch: Partial<AIDraft> = {};
    const quotaPattern = /(\d+)\s+(Stack|Heap|Queue|Arrays|Binary Search|Linked List|Trees|Graphs|Dynamic Programming|Backtracking|Hashing|Two Pointers|Sliding Window|Recursion|Greedy|Trie)/gi;
    const matches = [...text.matchAll(quotaPattern)];
    if (matches.length) patch.topicQuotas = matches.map((m) => ({ topic: m[2], count: parseInt(m[1], 10) }));

    const focus = text.match(/focus\s+on\s+([^\.]+)/i);
    if (focus && !patch.topicQuotas) patch.focusTopics = focus[1].split(/,|and/).map((s) => s.trim()).filter(Boolean);

    const dur = text.match(/(\d+)\s*days/i);
    if (dur) patch.durationDays = parseInt(dur[1], 10);

    if (/start\s+(today|now)/i.test(text) || /\btoday\b/i.test(text)) {
      patch.startDate = today;
    } else {
      const d = text.match(/(\d{4}-\d{2}-\d{2})/);
      if (d) patch.startDate = d[1];
    }

    if (/coder\s*army|sheet/i.test(text)) patch.source = 'coderarmy';
    else if (/neetcode|150/i.test(text)) patch.source = 'neetcode150';

    const dates = [...text.matchAll(/(\d{4}-\d{2}-\d{2})/g)];
    if (dates.length) patch.busyDays = dates.map((d) => ({ date: d[1], loadReduction: 0.6, reason: 'Busy day' }));

    return patch;
  },
};
```

---

## 2. `frontend/src/types/index.ts`
**Link**: [`index.ts`](file:///c:/Users/shiva/Daily_Tracker/frontend/src/types/index.ts)

Added `AIAction` and updated `AIConversationResponse`:

```ts
export type AIAction = 'none' | 'show_draft' | 'offer_preview';

export interface AIConversationResponse {
  reply: string;
  intent: AIIntent;
  action: AIAction;
  draft: AIDraft;
  missingFields: string[];
  done: boolean;
  confidence: 'high' | 'low';
  warnings: string[];
  assumptions: string[];
}
```

---

## 3. `frontend/src/components/plan/AIPlanChat.tsx`
**Link**: [`AIPlanChat.tsx`](file:///c:/Users/shiva/Daily_Tracker/frontend/src/components/plan/AIPlanChat.tsx)

Removed auto actions (`actOnIntent`), added `getLocalDateKey()`, suppressed `focusTopics` when quotas exist, and rendered warnings/assumptions:

```tsx
import { useState } from 'react';
import { planApi } from '../../services/planApi';
import type {
  AIChatMessage,
  AIDraft,
  GeneratePlanPayload,
  PlanSource,
  AIAction,
} from '../../types';

interface Props {
  onGeneratePreview: (payload: GeneratePlanPayload) => void;
  onCommit: () => void;
  onTweakManually: (draft: AIDraft) => void;
  canCommit: boolean;        // true only after a preview is loaded
  previewLoaded: boolean;    // drives the "Create Plan" button
}

function getLocalDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const [action, setAction] = useState<AIAction>('none');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);

  const buildPayload = (): GeneratePlanPayload => {
    const today = getLocalDateKey();
    const hasQuotas = Boolean(draft?.topicQuotas?.length);
    return {
      source: (draft?.source as PlanSource) || 'neetcode150',
      startDate: draft?.startDate || today,
      durationDays: draft?.durationDays || 30,
      pace: (draft?.pace as any) || 'moderate',
      weekdayLoad: draft?.weekdayLoad ?? 2,
      weekendLoad: draft?.weekendLoad ?? 3,
      topicQuotas: hasQuotas ? draft!.topicQuotas! : undefined,
      focusTopics: hasQuotas ? undefined : draft?.focusTopics ?? undefined,
      avoidTopics: draft?.avoidTopics ?? undefined,
      busyDays: draft?.busyDays ?? [],
    };
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
      setAction(res.action);
      setWarnings(res.warnings ?? []);
      setAssumptions(res.assumptions ?? []);
      setMessages([...newMessages, { role: 'assistant', content: res.reply }]);
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
              <button className="btn-primary" onClick={() => onGeneratePreview(buildPayload())}>
                🚀 Generate Preview
              </button>
            )}
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
```

---

## 4. `frontend/src/components/plan/PlanWizard.tsx`
**Link**: [`PlanWizard.tsx`](file:///c:/Users/shiva/Daily_Tracker/frontend/src/components/plan/PlanWizard.tsx)

Uses `getLocalDateKey()` for default `startDate` and manual tweaks:

```tsx
function getLocalDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PlanWizard() {
  const [startDate, setStartDate] = useState(getLocalDateKey());

  const handleTweakManually = (draft: AIDraft) => {
    setSource(draft.source || 'neetcode150');
    setStartDate(draft.startDate || getLocalDateKey());
    // ...
  };
  // ...
}
```
