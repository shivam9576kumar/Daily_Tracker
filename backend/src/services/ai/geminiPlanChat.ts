import { env } from '../../config/env';
import { geminiGenerate } from '../../utils/geminiClient';
import logger from '../../utils/logger';
import { loadQuestionBank, getAvailableTopics } from '../plan/questionBankLoader';
import { todayKey } from '../../utils/dateKeys';
import { resolveTopic } from '../../utils/topicNormalize';

export interface TopicQuota { topic: string; count: number; all?: boolean; }
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
  scheduleMode?: 'balanced' | 'sequential' | null;
}

export type AIIntent =
  | 'general_chat'
  | 'plan_building'
  | 'request_preview'
  | 'request_commit'
  | 'off_topic';

export type AIAction = 'none' | 'show_draft' | 'offer_preview';

export interface AIChatMessage { role: 'user' | 'assistant'; content: string; }

export interface AIPlannerContext {
  today: string;
  timezone: string;
  hasActivePlan: boolean;
  sources: {
    id: 'neetcode150' | 'coderarmy';
    name: string;
    total: number;
    topics: {
      name: string;
      available: number;
    }[];
  }[];
}

export interface AIConversationRequest {
  messages: AIChatMessage[];
  draft: AIDraft;
  context: AIPlannerContext;
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

const VALID_SOURCES = ['neetcode150', 'coderarmy'];
const VALID_INTENTS: AIIntent[] = ['general_chat', 'plan_building', 'request_preview', 'request_commit', 'off_topic'];

function isPlanningIntent(intent: AIIntent): boolean {
  return (
    intent === 'plan_building' ||
    intent === 'request_preview' ||
    intent === 'request_commit'
  );
}

function safeGeneralFallbackReply(
  intent: AIIntent,
  context: AIPlannerContext
): string {
  if (intent === 'off_topic') {
    return 'I’m focused on DSA study planning, interview preparation, and helping you learn data structures and algorithms. What would you like to study?';
  }

  return `I’m your DSA study-plan assistant. Today is ${context.today} in ${context.timezone}. I can help with DSA questions or build a study plan when you are ready.`;
}

interface BankTopicMeta {
  name: string;
  available: number;
}

interface BankSourceMeta {
  id: 'neetcode150' | 'coderarmy';
  name: string;
  total: number;
  topics: BankTopicMeta[];
}

interface BankMeta {
  sources: BankSourceMeta[];
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const BUSY_DATE_PATTERN =
  /\b(?:exam|test|midterm|final|busy(?:\s+day)?|travel|event|college\s+event)\s*(?:on|:)?\s*((?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?))/gi;

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function parseBusyDateToken(token: string, todayKeyStr: string): string | null {
  const trimmed = token.trim();
  if (isValidDateKey(trimmed)) {
    return trimmed;
  }

  const m = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/);
  if (!m) return null;

  const dayNum = parseInt(m[1], 10);
  const monthKey = m[2].toLowerCase();
  const monthNum = MONTH_NAMES[monthKey];
  if (!monthNum || dayNum < 1 || dayNum > 31) return null;

  const currentYear = todayKeyStr ? parseInt(todayKeyStr.slice(0, 4), 10) : new Date().getFullYear();
  const yearNum = m[3] ? parseInt(m[3], 10) : currentYear;

  const mm = String(monthNum).padStart(2, '0');
  const dd = String(dayNum).padStart(2, '0');
  const resultKey = `${yearNum}-${mm}-${dd}`;

  return isValidDateKey(resultKey) ? resultKey : null;
}

function resolveCanonicalTopic(
  input: string,
  source: 'neetcode150' | 'coderarmy' | null,
  context: AIPlannerContext
): string | null {
  const allowedSources = source
    ? context.sources.filter((item) => item.id === source)
    : context.sources;

  const bankTopics = allowedSources.flatMap((s) => s.topics.map((t) => t.name));
  return resolveTopic(input, bankTopics);
}

function normalizeDraftTopics(
  draft: AIDraft,
  context: AIPlannerContext
): {
  draft: AIDraft;
  warnings: string[];
} {
  const warnings: string[] = [];
  const source = draft.source === 'coderarmy' || draft.source === 'neetcode150' ? draft.source : null;

  const quotaMap = new Map<string, number>();

  for (const quota of draft.topicQuotas ?? []) {
    if (!quota || typeof quota.topic !== 'string') continue;
    const canonical = resolveCanonicalTopic(quota.topic, source, context);

    if (!canonical) {
      warnings.push(`"${quota.topic}" is not available in the selected question bank and was removed.`);
      continue;
    }

    const count = Math.floor(Number(quota.count));

    if (!Number.isFinite(count) || count < 1) {
      warnings.push(`"${canonical}" needs a question count of at least 1.`);
      continue;
    }

    quotaMap.set(
      canonical,
      (quotaMap.get(canonical) ?? 0) + count
    );
  }

  const sourceMeta = source
    ? context.sources.find((item) => item.id === source)
    : null;

  const normalizedQuotas = [...quotaMap.entries()]
    .map(([topic, requested]) => {
      const available = sourceMeta?.topics.find(
        (item) => item.name === topic
      )?.available;

      if (typeof available === 'number' && requested > available) {
        warnings.push(
          `Only ${available} ${topic} questions are available in ${
            sourceMeta?.name ?? 'the selected bank'
          }. Your requested ${requested} was reduced to ${available}.`
        );

        return {
          topic,
          count: available,
        };
      }

      return {
        topic,
        count: requested,
      };
    })
    .filter((item) => item.count > 0);

  const focusMap = new Map<string, string>();

  for (const focusTopic of draft.focusTopics ?? []) {
    if (typeof focusTopic !== 'string') continue;
    const canonical = resolveCanonicalTopic(focusTopic, source, context);

    if (!canonical) {
      warnings.push(`"${focusTopic}" is not an available focus topic and was removed.`);
      continue;
    }

    focusMap.set(canonical.toLowerCase(), canonical);
  }

  const avoidMap = new Map<string, string>();

  for (const avoidTopic of draft.avoidTopics ?? []) {
    if (typeof avoidTopic !== 'string') continue;
    const canonical = resolveCanonicalTopic(avoidTopic, source, context);

    if (!canonical) {
      warnings.push(`"${avoidTopic}" is not an available avoid topic and was removed.`);
      continue;
    }

    avoidMap.set(canonical.toLowerCase(), canonical);
  }


  const normalizedDraft: AIDraft = {
    ...draft,

    // Exact quotas win over focus topics.
    topicQuotas: normalizedQuotas.length ? normalizedQuotas : null,
    focusTopics: normalizedQuotas.length
      ? null
      : [...focusMap.values()].length
      ? [...focusMap.values()]
      : null,

    avoidTopics: [...avoidMap.values()].length
      ? [...avoidMap.values()]
      : null,
  };

  return {
    draft: normalizedDraft,
    warnings,
  };
}

function normalizeIntent(v: unknown): AIIntent {
  return typeof v === 'string' && (VALID_INTENTS as string[]).includes(v) ? (v as AIIntent) : 'plan_building';
}

function computeAction(intent: AIIntent, done: boolean): AIAction {
  if (!done) return 'none';
  if (intent === 'request_preview') return 'offer_preview';
  if (intent === 'request_commit') return 'offer_preview'; // never commit from AI
  return 'show_draft';
}

function sanitizePatch(raw: any, todayKeyStr: string = ''): Partial<AIDraft> {
  const patch: Partial<AIDraft> = {};
  if (!raw || typeof raw !== 'object') return patch;

  if (typeof raw.source === 'string' && VALID_SOURCES.includes(raw.source)) patch.source = raw.source;
  if (typeof raw.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)) patch.startDate = raw.startDate;
  if (typeof raw.durationDays === 'number' && raw.durationDays > 0 && raw.durationDays <= 365) patch.durationDays = raw.durationDays;
  if (typeof raw.weekdayLoad === 'number' && raw.weekdayLoad > 0) patch.weekdayLoad = raw.weekdayLoad;
  if (typeof raw.weekendLoad === 'number' && raw.weekendLoad > 0) patch.weekendLoad = raw.weekendLoad;
  if (typeof raw.pace === 'string' && ['relaxed', 'moderate', 'intensive', 'custom'].includes(raw.pace)) patch.pace = raw.pace;
  if (typeof raw.bufferDay === 'number' && raw.bufferDay >= 0 && raw.bufferDay <= 6) patch.bufferDay = raw.bufferDay;
  if (typeof raw.scheduleMode === 'string' && ['balanced', 'sequential'].includes(raw.scheduleMode)) patch.scheduleMode = raw.scheduleMode as 'balanced' | 'sequential';

  if (Array.isArray(raw.topicQuotas)) {
    const q = raw.topicQuotas
      .filter((x: any) => x && typeof x.topic === 'string' && (x.all === true || (Number.isInteger(x.count) && x.count > 0)))
      .map((x: any) => ({ topic: x.topic, count: x.all ? 9999 : x.count, ...(x.all ? { all: true } : {}) }));
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
      .map((x: any) => {
        if (!x || typeof x !== 'object') return null;
        const parsedDate = typeof x.date === 'string' ? parseBusyDateToken(x.date, todayKeyStr) : null;
        if (!parsedDate) return null;
        return {
          date: parsedDate,
          reason: typeof x.reason === 'string' && x.reason.trim() ? x.reason.trim() : 'Exam / Busy day',
          loadReduction: typeof x.loadReduction === 'number' ? Math.min(1, Math.max(0, x.loadReduction)) : 0.6,
        };
      })
      .filter((x: any): x is BusyDayInput => x !== null);
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
    scheduleMode: patch.scheduleMode ?? prev.scheduleMode ?? null,
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

function buildSystemPrompt(context: AIPlannerContext): string {
  return `
You are a friendly, concise study-plan assistant for a DSA (Data Structures & Algorithms) tracker.

TRUSTED CONTEXT (use these, do not guess):
${JSON.stringify(context, null, 2)}

GENERAL CHAT RULES
- If user asks today's date, answer using TRUSTED CONTEXT.today and TRUSTED CONTEXT.timezone.
- If user asks "Are you AI or hardcoded?", answer naturally:
  "I am an AI-powered DSA study assistant. I understand your messages and help create plans. The deterministic scheduler creates the final exact tasks and dates."
- If user asks a basic DSA question, answer briefly and correctly.
- Do not force plan questions into general conversation.
- For general chat:
  intent = "general_chat"
  draftPatch = {}
- For unrelated requests:
  intent = "off_topic"
  draftPatch = {}

PLANNING RULES
- Quietly build a plan draft from anything the user says about studying.
- "10 Stack, 10 Heap, 10 Queue" -> topicQuotas [{topic, count}] (exact counts).
- "focus on Stack, Heap" (no counts) -> focusTopics.
- "finish all Stack then all Queue" -> set scheduleMode="sequential" and topicQuotas with [{topic: "Stack", count: 9999, all: true}, {topic: "Queue", count: 9999, all: true}] in that exact order.
- "30 questions, mostly Heap" -> propose a split and ASK to confirm before setting it.
- "15 days", "start today", "exam on 10 Sept" -> durationDays, startDate, busyDays.
- Only put a field in draftPatch if the user actually mentioned it this turn. Do NOT repeat unchanged fields.
- If the user changes something, update only that field.
- If user has an active plan and is building a new plan, mention:
  "You already have an active plan. You can preview this new plan, and the app will ask for confirmation before archiving the current one."
- Never set archiveExisting from AI response.
- Never create, commit, archive, or preview automatically.
- If the user clearly wants a preview ("generate it", "show me the schedule") set intent = "request_preview".
- If the user clearly wants to finalize ("create the plan", "yes make it") set intent = "request_commit".

FORMATTING FOR CODE/DSA ANSWERS:
- When the user asks for code, explanation, approach, or DSA solution:
  - reply MUST be GitHub Flavored Markdown.
  - Structure: 1-line intro + blank line + fenced code block with language tag + blank line + Time/Space Complexity bullets.
  - Always use a language tag: \`\`\`cpp, \`\`\`java, \`\`\`python — never bare \`\`\`.
  - Keep real newlines inside the reply string as \n. Do NOT collapse code to one line.
  - Do NOT escape or remove backticks inside reply.
  - For code/explanation questions: intent = "general_chat", action = "none", missingFields = [], done = false.
  - Example reply value:
    "Here is the O(n) hash map approach:\n\n\`\`\`cpp\nvector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> m;\n    for (int i = 0; i < nums.size(); i++) {\n        if (m.count(target - nums[i])) return {m[target - nums[i]], i};\n        m[nums[i]] = i;\n    }\n    return {};\n}\n\`\`\`\n\n- **Time:** O(n)\n- **Space:** O(n)"

OUTPUT: return JSON ONLY (the outer wrapper is JSON, but the reply field inside may contain markdown). Use this exact shape:
{
  "reply": "your natural chat message — may contain GitHub Flavored Markdown including fenced code blocks",
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
  },
  "warnings": ["string"],
  "assumptions": ["string"]
}
`;
}

/**
 * Extract JSON from Gemini response. Only strips the outermost ```json fence,
 * preserving all code fences inside the reply field.
 */
function extractJson(raw: string): string {
  const t = raw.trim();
  // Match outermost ```json ... ``` wrapper only
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (m) return m[1].trim();
  return t;
}

export const geminiPlanChat = {
  async process(req: AIConversationRequest): Promise<AIChatResponse> {
    const { messages, draft, context } = req;

    if (!env.GEMINI_API_KEY) {
      return this.offlineReply(messages, draft, context);
    }

    const systemPrompt = buildSystemPrompt(context);
    const convo = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    const prompt = `${systemPrompt}\n\nCurrent draft:\n${JSON.stringify(draft)}\n\nConversation:\n${convo}\n\nRespond with JSON only.`;

    try {
      const raw = await geminiGenerate(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { temperature: 0.2, responseMimeType: 'application/json' }
      );
      const cleaned = extractJson(raw);
      const parsed = JSON.parse(cleaned);

      const reply =
        typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim()
          : '';

      const intent = normalizeIntent(parsed.intent);

      const warningsFromModel = Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      const assumptionsFromModel = Array.isArray(parsed.assumptions)
        ? parsed.assumptions.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      if (!isPlanningIntent(intent)) {
        const normalized = normalizeDraftTopics(draft || {}, context);
        return {
          reply: reply || safeGeneralFallbackReply(intent, context),
          intent,
          action: 'none',
          draft: normalized.draft,
          missingFields: [],
          done: false,
          confidence: 'high',
          warnings: warningsFromModel,
          assumptions: assumptionsFromModel,
        };
      }

      const patch = sanitizePatch(parsed.draftPatch || parsed.draft || {}, context.today);
      const merged = mergeDraft(draft, patch);
      const normalized = normalizeDraftTopics(merged, context);
      const finalDraft = normalized.draft;
      const { missingFields, done } = computeMissing(finalDraft);

      return {
        reply: reply || this.composeFallbackReply(finalDraft, missingFields),
        intent,
        action: computeAction(intent, done),
        draft: finalDraft,
        missingFields,
        done,
        confidence: 'high',
        warnings: [...warningsFromModel, ...normalized.warnings],
        assumptions: assumptionsFromModel,
      };
    } catch (err) {
      logger.error('geminiPlanChat: Gemini call failed, using offline fallback', err);
      return this.offlineReply(messages, draft, context);
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

  offlineReply(messages: AIChatMessage[], draft: AIDraft, context: AIPlannerContext): AIChatResponse {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';

    const patch = this.extractPatch(text, context.today);
    const merged = mergeDraft(draft, patch);
    const normalized = normalizeDraftTopics(merged, context);
    const finalDraft = normalized.draft;
    const { missingFields, done } = computeMissing(finalDraft);

    const hasPlanSignal =
      /stack|heap|queue|array|graph|dp|binary search|neetcode|coder|sheet|plan|days|focus/i.test(text);

    let reply: string;
    let intent: AIIntent;
    if (!hasPlanSignal) {
      reply = `I'm running in offline mode (no AI key set), so I can't free-chat right now. Today is ${context.today}. Add GEMINI_API_KEY to enable conversation. Meanwhile, tell me your source, topics (or counts), and days to build a plan.`;
      intent = 'general_chat';

      return {
        reply,
        intent,
        action: 'none',
        draft: finalDraft,
        missingFields: [],
        done: false,
        confidence: 'low',
        warnings: [...normalized.warnings],
        assumptions: [],
      };
    } else {
      const got = [];
      if (finalDraft.source) got.push(finalDraft.source === 'coderarmy' ? 'Coder Army' : 'NeetCode 150');
      if (finalDraft.topicQuotas?.length) got.push(finalDraft.topicQuotas.map((q) => `${q.count} ${q.topic}`).join(', '));
      if (finalDraft.focusTopics?.length) got.push('focus: ' + finalDraft.focusTopics.join(', '));
      if (finalDraft.durationDays) got.push(`${finalDraft.durationDays} days`);
      const still = missingFields.length ? ` Still need: ${missingFields.join(', ')}.` : ' Ready to preview!';
      reply = `Offline mode (no AI key) — I can still build your plan. I read: ${got.join(', ') || 'nothing yet'}.${still}`;
      intent = 'plan_building';

      return {
        reply,
        intent,
        action: done ? 'show_draft' : 'none',
        draft: finalDraft,
        missingFields,
        done,
        confidence: 'low',
        warnings: [...normalized.warnings],
        assumptions: [],
      };
    }
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
      const d = text.match(/start\s*(?:on|:)?\s*(\d{4}-\d{2}-\d{2})/i);
      if (d) patch.startDate = d[1];
    }

    if (/coder\s*army|sheet/i.test(text)) patch.source = 'coderarmy';
    else if (/neetcode|150/i.test(text)) patch.source = 'neetcode150';

    const busyMatches = [...text.matchAll(BUSY_DATE_PATTERN)];
    if (busyMatches.length) {
      const busyList: BusyDayInput[] = [];
      for (const match of busyMatches) {
        const parsedDate = parseBusyDateToken(match[1], today);
        if (parsedDate) {
          busyList.push({
            date: parsedDate,
            reason: 'Exam / Busy day',
            loadReduction: 0.6,
          });
        }
      }
      if (busyList.length) patch.busyDays = busyList;
    }

    return patch;
  },
};

