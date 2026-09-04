# Complete Code Changes & Exact Code Written

This document contains the exact code written and added across all files in the project for the **Real Conversational AI Plan Generator + `topicQuotas` Fix**.

---

## 1. `backend/src/services/ai/geminiPlanChat.ts` (REWRITTEN)
**Link**: [`geminiPlanChat.ts`](file:///c:/Users/shiva/Daily_Tracker/backend/src/services/ai/geminiPlanChat.ts)

Full implementation of real AI conversation, trusted context injection, intent classification, draft patch sanitization, and offline mode fallback:

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

export interface AIChatMessage { role: 'user' | 'assistant'; content: string; }

export interface AIConversationRequest {
  messages: AIChatMessage[];
  draft: AIDraft;
  timezone?: string;
}

export interface AIChatResponse {
  reply: string;            // ALWAYS the text shown in the chat bubble
  intent: AIIntent;
  draft: AIDraft;
  missingFields: string[];  // computed by the app, not the model
  done: boolean;            // computed by the app
  confidence: 'high' | 'low';
}

const VALID_SOURCES = ['neetcode150', 'coderarmy'];
const VALID_INTENTS: AIIntent[] = ['general_chat', 'plan_building', 'request_preview', 'request_commit', 'off_topic'];

interface BankMeta {
  sources: { id: string; name: string; total: number }[];
  topics: string[];
  counts: Record<string, number>;
}

let bankMetaCache: BankMeta | null = null;
function getBankMeta(): BankMeta {
  if (bankMetaCache) return bankMetaCache;
  const nc = loadQuestionBank('neetcode150');
  const ca = loadQuestionBank('coderarmy');
  const counts: Record<string, number> = {};
  for (const q of ca) counts[q.topic] = (counts[q.topic] || 0) + 1;
  bankMetaCache = {
    sources: [
      { id: 'neetcode150', name: 'NeetCode 150', total: nc.length },
      { id: 'coderarmy', name: 'Coder Army Sheet', total: ca.length },
    ],
    topics: getAvailableTopics(ca),
    counts,
  };
  return bankMetaCache;
}

function normalizeIntent(v: unknown): AIIntent {
  return typeof v === 'string' && (VALID_INTENTS as string[]).includes(v) ? (v as AIIntent) : 'plan_building';
}

function sanitizePatch(raw: any): Partial<AIDraft> {
  const patch: Partial<AIDraft> = {};
  if (!raw || typeof raw !== 'object') return patch;

  if (typeof raw.source === 'string' && VALID_SOURCES.includes(raw.source)) patch.source = raw.source;
  if (typeof raw.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)) patch.startDate = raw.startDate;
  if (typeof raw.durationDays === 'number' && raw.durationDays > 0 && raw.durationDays <= 365) patch.durationDays = raw.durationDays;
  if (typeof raw.weekdayLoad === 'number' && raw.weekdayLoad > 0) patch.weekdayLoad = raw.weekdayLoad;
  if (typeof raw.weekendLoad === 'number' && raw.weekendLoad > 0) patch.weekendLoad = raw.weekendLoad;
  if (typeof raw.pace === 'string' && ['relaxed', 'moderate', 'intensive', 'custom'].includes(raw.pace)) patch.pace = raw.pace;
  if (typeof raw.bufferDay === 'number' && raw.bufferDay >= 0 && raw.bufferDay <= 6) patch.bufferDay = raw.bufferDay;

  if (Array.isArray(raw.topicQuotas)) {
    const q = raw.topicQuotas
      .filter((x: any) => x && typeof x.topic === 'string' && Number.isInteger(x.count) && x.count > 0)
      .map((x: any) => ({ topic: x.topic, count: x.count }));
    if (q.length) patch.topicQuotas = q;
  }
  if (Array.isArray(raw.focusTopics)) {
    const f = raw.focusTopics.filter((x: any) => typeof x === 'string' && x.trim());
    if (f.length) patch.focusTopics = f;
  }
  if (Array.isArray(raw.avoidTopics)) {
    const a = raw.avoidTopics.filter((x: any) => typeof x === 'string' && x.trim());
    if (a.length) patch.avoidTopics = a;
  }
  if (Array.isArray(raw.busyDays)) {
    const b = raw.busyDays
      .filter((x: any) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date))
      .map((x: any) => ({
        date: x.date,
        reason: typeof x.reason === 'string' ? x.reason : undefined,
        loadReduction: typeof x.loadReduction === 'number' ? Math.min(1, Math.max(0, x.loadReduction)) : 0.6,
      }));
    if (b.length) patch.busyDays = b;
  }
  return patch;
}

function mergeDraft(prev: AIDraft, patch: Partial<AIDraft>): AIDraft {
  return {
    source: patch.source ?? prev.source ?? null,
    startDate: patch.startDate ?? prev.startDate ?? null,
    durationDays: patch.durationDays ?? prev.durationDays ?? null,
    pace: patch.pace ?? prev.pace ?? null,
    weekdayLoad: patch.weekdayLoad ?? prev.weekdayLoad ?? null,
    weekendLoad: patch.weekendLoad ?? prev.weekendLoad ?? null,
    topicQuotas: patch.topicQuotas ?? prev.topicQuotas ?? null,
    focusTopics: patch.focusTopics ?? prev.focusTopics ?? null,
    avoidTopics: patch.avoidTopics ?? prev.avoidTopics ?? null,
    busyDays: patch.busyDays ?? prev.busyDays ?? null,
    bufferDay: patch.bufferDay ?? prev.bufferDay ?? null,
  };
}

function computeMissing(draft: AIDraft): { missingFields: string[]; done: boolean } {
  const missingFields: string[] = [];
  if (!draft.source) missingFields.push('source');
  if (!draft.startDate) missingFields.push('startDate');
  if (!draft.durationDays) missingFields.push('durationDays');
  if (!draft.topicQuotas?.length && !draft.focusTopics?.length) missingFields.push('topics');
  return { missingFields, done: missingFields.length === 0 };
}

function buildSystemPrompt(ctx: { today: string; timezone: string; sources: any[]; topics: string[]; topicCounts: Record<string, number> }): string {
  return `
You are a friendly, concise study-plan assistant for a DSA (Data Structures & Algorithms) tracker.

TRUSTED CONTEXT (use these, do not guess):
${JSON.stringify(ctx, null, 2)}

YOUR TWO JOBS
1. Be a normal chat. Answer the user's actual question in 1-3 friendly sentences.
   - "what is today's date?" -> use TRUSTED CONTEXT.today.
   - "are you AI?" -> say you are an AI study-plan assistant.
   - DSA doubts (e.g. "what is binary search", "can I finish 100 in 10 days?") -> answer helpfully using TRUSTED CONTEXT.
2. Quietly build a plan draft from anything the user says about studying.

DRAFT RULES
- "10 Stack, 10 Heap, 10 Queue" -> topicQuotas [{topic, count}] (exact counts).
- "focus on Stack, Heap" (no counts) -> focusTopics.
- "30 questions, mostly Heap" -> propose a split and ASK to confirm before setting it.
- "15 days", "start today", "exam on 10 Sept" -> durationDays, startDate, busyDays.
- Only put a field in draftPatch if the user actually mentioned it this turn. Do NOT repeat unchanged fields.
- If the user changes something, update only that field.

SAFETY
- Never create a plan by yourself. You only propose. The app generates the preview and the user confirms.
- If the user clearly wants a preview ("generate it", "show me the schedule") set intent = "request_preview".
- If the user clearly wants to finalize ("create the plan", "yes make it") set intent = "request_commit".
- If the user is just chatting, intent = "general_chat".
- If the user asks for something unrelated to DSA/study (e.g. write a song), intent = "off_topic" and politely redirect to DSA planning in your reply.

OUTPUT: return JSON ONLY, no markdown, with this exact shape:
{
  "reply": "your natural 1-3 sentence chat message (this is what the user sees)",
  "intent": "general_chat" | "plan_building" | "request_preview" | "request_commit" | "off_topic",
  "draftPatch": {
    "source": "neetcode150" | "coderarmy" | null,
    "startDate": "YYYY-MM-DD" | null,
    "durationDays": number | null,
    "pace": "relaxed" | "moderate" | "intensive" | "custom" | null,
    "weekdayLoad": number | null,
    "weekendLoad": number | null,
    "topicQuotas": [{ "topic": string, "count": number }] | null,
    "focusTopics": string[] | null,
    "avoidTopics": string[] | null,
    "busyDays": [{ "date": "YYYY-MM-DD", "reason": string, "loadReduction": number }] | null,
    "bufferDay": number | null
  }
}
`;
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
      const merged = mergeDraft(draft, patch);
      const { missingFields, done } = computeMissing(merged);
      return {
        reply: reply || this.composeFallbackReply(merged, missingFields),
        intent,
        draft: merged,
        missingFields,
        done,
        confidence: 'high',
      };
    } catch (err) {
      logger.error('geminiPlanChat: Gemini call failed, using offline fallback', err);
      return this.offlineReply(messages, draft, ctx);
    }
  },

  composeFallbackReply(draft: AIDraft, missingFields: string[]): string {
    if (missingFields.length === 0) return 'Your plan is ready. Tap Generate Preview to see the schedule.';
    const first = missingFields[0];
    const ask: Record<string, string> = {
      source: 'Which source should I use — NeetCode 150 or Coder Army Sheet?',
      startDate: 'When should the plan start?',
      durationDays: 'How many days should it run?',
      topics: 'Which topics, or exact counts per topic?',
    };
    return ask[first] ?? 'Tell me a bit more and I will set it up.';
  },

  offlineReply(messages: AIChatMessage[], draft: AIDraft, ctx: { today: string }): AIChatResponse {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';

    const patch = this.extractPatch(text);
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

    return { reply, intent, draft: merged, missingFields, done, confidence: 'low' };
  },

  extractPatch(text: string): Partial<AIDraft> {
    const patch: Partial<AIDraft> = {};
    const quotaPattern = /(\d+)\s+(Stack|Heap|Queue|Arrays|Binary Search|Linked List|Trees|Graphs|Dynamic Programming|Backtracking|Hashing|Two Pointers|Sliding Window|Recursion|Greedy|Trie)/gi;
    const matches = [...text.matchAll(quotaPattern)];
    if (matches.length) patch.topicQuotas = matches.map((m) => ({ topic: m[2], count: parseInt(m[1], 10) }));

    const focus = text.match(/focus\s+on\s+([^\.]+)/i);
    if (focus && !patch.topicQuotas) patch.focusTopics = focus[1].split(/,|and/).map((s) => s.trim()).filter(Boolean);

    const dur = text.match(/(\d+)\s*days/i);
    if (dur) patch.durationDays = parseInt(dur[1], 10);

    if (/start\s+(today|now)/i.test(text) || /\btoday\b/i.test(text)) {
      patch.startDate = new Date().toISOString().split('T')[0];
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

## 2. `backend/src/controllers/planController.ts`
**Link**: [`planController.ts`](file:///c:/Users/shiva/Daily_Tracker/backend/src/controllers/planController.ts)

Forwarded timezone header:

```ts
import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { planGenerationService } from '../services/plan/planGenerationService';
import { planService } from '../services/plan/planService';
import { geminiPlanParser } from '../services/ai/geminiPlanParser';
import { geminiPlanChat } from '../services/ai/geminiPlanChat';
import { sendSuccess } from '../utils/response';
import { ValidationError } from '../utils/error';

export const planController = {
  async aiConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const { messages, draft } = req.body;
      if (!messages || !Array.isArray(messages)) throw new ValidationError('messages is required');
      if (!draft) throw new ValidationError('draft is required');
      const result = await geminiPlanChat.process({ messages, draft, timezone: getTz(req) });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
  // ...
};
```

---

## 3. `frontend/src/types/index.ts`
**Link**: [`index.ts`](file:///c:/Users/shiva/Daily_Tracker/frontend/src/types/index.ts)

Added `AIIntent` type and updated `AIConversationResponse`:

```ts
export type AIIntent =
  | 'general_chat'
  | 'plan_building'
  | 'request_preview'
  | 'request_commit'
  | 'off_topic';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIConversationRequest {
  messages: AIChatMessage[];
  draft: AIDraft;
  timezone?: string;
}

export interface AIConversationResponse {
  reply: string;
  intent: AIIntent;
  draft: AIDraft;
  missingFields: string[];
  done: boolean;
  confidence: 'high' | 'low';
}
```

---

## 4. `frontend/src/components/plan/AIPlanChat.tsx`
**Link**: [`AIPlanChat.tsx`](file:///c:/Users/shiva/Daily_Tracker/frontend/src/components/plan/AIPlanChat.tsx)

Renders verbatim Gemini reply and executes intent actions:

```tsx
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
```

---

## 5. `frontend/src/components/plan/PlanWizard.tsx`
**Link**: [`PlanWizard.tsx`](file:///c:/Users/shiva/Daily_Tracker/frontend/src/components/plan/PlanWizard.tsx)

Updated props passed to `<AIPlanChat />`:

```tsx
const previewLoaded = Boolean(previewData);

{mode === 'ai' ? (
  <>
    <AIPlanChat
      onGeneratePreview={(payload) => handleGeneratePreview(payload)}
      onCommit={() => handleCommit()}
      onTweakManually={handleTweakManually}
      canCommit={previewLoaded}
      previewLoaded={previewLoaded}
    />
    {previewData && (
      <div style={{ marginTop: 24 }}>
        <PlanPreview
          preview={previewData}
          onCommit={handleCommit}
          committing={committing}
        />
      </div>
    )}
  </>
) : (
  // 5-step manual wizard...
)}
```
