import { env } from '../../config/env';
import { geminiGenerate } from '../../utils/geminiClient';
import logger from '../../utils/logger';

export interface TopicQuota {
  topic: string;
  count: number;
}

export interface BusyDayInput {
  date: string;
  reason?: string;
  loadReduction: number;
}

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

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIConversationRequest {
  messages: AIChatMessage[];
  draft: AIDraft;
}

export interface AIConversationResponse {
  draft: AIDraft;
  missingFields: string[];
  question: string;
  done: boolean;
  confidence: 'high' | 'low';
}

export const geminiPlanChat = {
  async process(req: AIConversationRequest): Promise<AIConversationResponse> {
    const { messages, draft } = req;

    // If no API key, use heuristic
    if (!env.GEMINI_API_KEY) {
      return this.heuristicChatParse(messages, draft);
    }

    const systemPrompt = `
      You are a study-plan assistant for a DSA tracker.
      Convert the user's natural language into a structured plan draft.

      Rules:
      - If user says "10 Stack, 10 Heap, 10 Queue" → extract topicQuotas: [{topic:"Stack", count:10}, ...]
      - If user says "focus on Stack, Heap, Queue" (no counts) → extract focusTopics (NOT quotas).
      - If user says "30 questions, mostly Heap" → suggest a split and ASK for confirmation.
      - Always preserve existing draft fields. Only update what the user mentions.
      - Required fields: source, startDate, durationDays, and at least one of topicQuotas or focusTopics.
      - If any required field is missing, ask a short clarifying question.
      - If the plan is unrealistic (e.g., 715 problems in 14 days), add a warning and suggest an alternative.
      - Return JSON ONLY with schema:
        {
          "draft": {
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
          "missingFields": ["source", "startDate", "durationDays", "topics"],
          "question": "next question",
          "done": true/false,
          "confidence": "high" | "low"
        }
    `;

    const userHistory = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
    const assistantHistory = messages.filter((m) => m.role === 'assistant').map((m) => m.content).join('\n');
    const prompt = `${systemPrompt}\n\nCurrent draft JSON:\n${JSON.stringify(draft)}\n\nUser history:\n${userHistory}\n\nAssistant history:\n${assistantHistory}\n\nRespond with JSON only.`;

    try {
      const rawText = await geminiGenerate(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { temperature: 0.1, responseMimeType: 'application/json' }
      );
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const nextDraft = parsed.draft || parsed;
      return this.mergeDraft(draft, nextDraft);
    } catch (err) {
      logger.error('geminiPlanChat Gemini API error, falling back to heuristic:', err);
      return this.heuristicChatParse(messages, draft);
    }
  },

  mergeDraft(prev: AIDraft, next: Partial<AIDraft>): AIConversationResponse {
    const merged: AIDraft = {
      source: next.source ?? prev.source ?? null,
      startDate: next.startDate ?? prev.startDate ?? null,
      durationDays: next.durationDays ?? prev.durationDays ?? null,
      pace: next.pace ?? prev.pace ?? null,
      weekdayLoad: next.weekdayLoad ?? prev.weekdayLoad ?? null,
      weekendLoad: next.weekendLoad ?? prev.weekendLoad ?? null,
      topicQuotas: next.topicQuotas ?? prev.topicQuotas ?? null,
      focusTopics: next.focusTopics ?? prev.focusTopics ?? null,
      avoidTopics: next.avoidTopics ?? prev.avoidTopics ?? null,
      busyDays: next.busyDays ?? prev.busyDays ?? null,
      bufferDay: next.bufferDay ?? prev.bufferDay ?? null,
    };

    return this.computeMissing(merged);
  },

  computeMissing(draft: AIDraft): AIConversationResponse {
    const missingFields: string[] = [];
    if (!draft.source) missingFields.push('source');
    if (!draft.startDate) missingFields.push('startDate');
    if (!draft.durationDays) missingFields.push('durationDays');
    if (!draft.topicQuotas && !draft.focusTopics) missingFields.push('topics');

    const done = missingFields.length === 0;
    const question = done ? '' : this.missingQuestion(missingFields);

    return {
      draft,
      missingFields,
      question,
      done,
      confidence: 'high',
    };
  },

  missingQuestion(fields: string[]): string {
    if (fields.includes('source')) return 'Which question bank? (NeetCode 150 or Coder Army Sheet)';
    if (fields.includes('startDate')) return 'When should the plan start?';
    if (fields.includes('durationDays')) return 'How many days do you want?';
    if (fields.includes('topics')) return 'Which topics? Or do you want exact counts per topic?';
    return 'I need more details to finalize the plan.';
  },

  heuristicChatParse(messages: AIChatMessage[], draft: AIDraft): AIConversationResponse {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const text = lastUser?.content ?? '';

    const quotas = this.extractQuotas(text);
    const focus = this.extractFocusTopics(text);
    const durationMatch = text.match(/(\d+)\s*days/i);
    const duration = durationMatch ? parseInt(durationMatch[1], 10) : null;

    let start: string | null = null;
    if (/start\s+(today|now)/i.test(text) || /today/i.test(text)) {
      start = new Date().toISOString().split('T')[0];
    } else {
      start = text.match(/start\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})/i)?.[1] ?? text.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    }

    const busy = this.extractBusyDays(text);

    const merged: AIDraft = {
      ...draft,
      topicQuotas: quotas ?? draft.topicQuotas ?? null,
      focusTopics: focus ?? draft.focusTopics ?? null,
      durationDays: duration ?? draft.durationDays ?? null,
      startDate: start ?? draft.startDate ?? null,
      busyDays: busy ?? draft.busyDays ?? null,
    };

    if (!merged.source) {
      if (/coder\s*army|sheet/i.test(text)) merged.source = 'coderarmy';
      else if (/neetcode|150/i.test(text)) merged.source = 'neetcode150';
    }

    const res = this.computeMissing(merged);
    res.confidence = 'low';
    return res;
  },

  extractQuotas(text: string): TopicQuota[] | null {
    const pattern = /(\d+)\s+(Stack|Heap|Queue|Arrays|Binary Search|Linked List|Trees|Graphs|Dynamic Programming|Backtracking|Hashing|Two Pointers|Sliding Window|Recursion|Greedy|Trie)/gi;
    const matches = [...text.matchAll(pattern)];
    if (!matches.length) return null;
    return matches.map((m) => ({ topic: m[2], count: parseInt(m[1], 10) }));
  },

  extractFocusTopics(text: string): string[] | null {
    const match = text.match(/focus\s+on\s+([^\.]+)/i);
    if (!match) return null;
    return match[1].split(/,|and/).map((s) => s.trim()).filter(Boolean);
  },

  extractBusyDays(text: string): BusyDayInput[] | null {
    const dates = [...text.matchAll(/(\d{4}-\d{2}-\d{2})/g)];
    if (!dates.length) {
      const wordMatch = text.match(/(\d{1,2})\s+(sept(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?)/i);
      if (wordMatch) {
        const day = wordMatch[1].padStart(2, '0');
        const monthStr = wordMatch[2].toLowerCase().substring(0, 3);
        const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        const mNum = months[monthStr] || '09';
        const year = new Date().getFullYear();
        return [{ date: `${year}-${mNum}-${day}`, loadReduction: 0.6, reason: 'Exam / Busy day' }];
      }
      return null;
    }
    return dates.map((d) => ({ date: d[1], loadReduction: 0.6, reason: 'User provided' }));
  },
};
