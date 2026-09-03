import { env } from '../../config/env';
import logger from '../../utils/logger';

export interface ParsedPlanSettings {
  source: string;
  durationDays: number;
  pace: 'relaxed' | 'moderate' | 'intensive' | 'custom';
  weekdayLoad: number;
  weekendLoad: number;
  focusTopics: string[];
  avoidTopics: string[];
  busyDays: {
    date: string; // YYYY-MM-DD
    reason?: string;
    loadReduction: number;
  }[];
  bufferDay: number; // 0 for Sunday
}

const SUPPORTED_TOPICS = [
  'Arrays',
  'Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Linked List',
  'Trees',
  'Heap',
  'Stack',
  'Queue',
  'Recursion',
  'Backtracking',
  'Graphs',
  'Dynamic Programming',
  'Greedy',
  'Math',
];

/**
 * Heuristic fallback parser when AI API is unreachable or key is unset.
 */
function heuristicParse(prompt: string): ParsedPlanSettings {
  const lower = prompt.toLowerCase();

  // 1. Duration
  let durationDays = 30;
  const daysMatch = lower.match(/(\d+)\s*(days?|day)/i);
  const weeksMatch = lower.match(/(\d+)\s*(weeks?|wk)/i);
  const monthsMatch = lower.match(/(\d+)\s*(months?|mo)/i);

  if (daysMatch) {
    durationDays = parseInt(daysMatch[1], 10);
  } else if (weeksMatch) {
    durationDays = parseInt(weeksMatch[1], 10) * 7;
  } else if (monthsMatch) {
    durationDays = parseInt(monthsMatch[1], 10) * 30;
  }

  if (durationDays < 1) durationDays = 7;
  if (durationDays > 180) durationDays = 180;

  // 2. Pace
  let pace: 'relaxed' | 'moderate' | 'intensive' = 'moderate';
  let weekdayLoad = 2.0;
  let weekendLoad = 3.0;

  if (lower.includes('relaxed') || lower.includes('chill') || lower.includes('slow') || lower.includes('light')) {
    pace = 'relaxed';
    weekdayLoad = 1.5;
    weekendLoad = 2.5;
  } else if (lower.includes('intensive') || lower.includes('fast') || lower.includes('hard') || lower.includes('grind') || lower.includes('heavy')) {
    pace = 'intensive';
    weekdayLoad = 3.0;
    weekendLoad = 4.5;
  }

  // 3. Topics
  const focusTopics: string[] = [];
  const avoidTopics: string[] = [];

  for (const topic of SUPPORTED_TOPICS) {
    const tLower = topic.toLowerCase();
    if (lower.includes(tLower) || (topic === 'Dynamic Programming' && (lower.includes('dp') || lower.includes('dynamic programming')))) {
      if (lower.includes(`no ${tLower}`) || lower.includes(`avoid ${tLower}`) || lower.includes(`skip ${tLower}`)) {
        avoidTopics.push(topic);
      } else {
        focusTopics.push(topic);
      }
    }
  }

  // 4. Busy days / Exams
  const busyDays: ParsedPlanSettings['busyDays'] = [];
  const year = new Date().getFullYear();

  // Match e.g. "10 September", "15 Sept", "Sept 10", "2026-09-10"
  const isoMatch = lower.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    busyDays.push({
      date: isoMatch[1],
      reason: 'Exam / Busy',
      loadReduction: 0.6,
    });
  } else {
    const monthNames: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', sept: '09', september: '09',
      oct: '10', nov: '11', dec: '12',
    };

    const dateWordMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i) ||
      lower.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i);

    if (dateWordMatch) {
      let dayPart = '';
      let monthPart = '';
      if (/^\d/.test(dateWordMatch[1])) {
        dayPart = dateWordMatch[1].padStart(2, '0');
        monthPart = dateWordMatch[2].toLowerCase();
      } else {
        monthPart = dateWordMatch[1].toLowerCase();
        dayPart = dateWordMatch[2].padStart(2, '0');
      }

      for (const [mPrefix, mNum] of Object.entries(monthNames)) {
        if (monthPart.startsWith(mPrefix)) {
          busyDays.push({
            date: `${year}-${mNum}-${dayPart}`,
            reason: 'Exam / Busy day',
            loadReduction: 0.6,
          });
          break;
        }
      }
    }
  }

  return {
    source: 'neetcode150',
    durationDays,
    pace,
    weekdayLoad,
    weekendLoad,
    focusTopics,
    avoidTopics,
    busyDays,
    bufferDay: 0,
  };
}

export const geminiPlanParser = {
  async parsePrompt(prompt: string): Promise<ParsedPlanSettings> {
    if (!prompt || !prompt.trim()) {
      return heuristicParse('');
    }

    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      logger.info('No GEMINI_API_KEY configured, using heuristic plan parser fallback.');
      return heuristicParse(prompt);
    }

    const systemInstruction = `You are an assistant that extracts DSA study plan settings from a student prompt.

Return ONLY valid JSON. No markdown. No explanation.

Supported source:
- neetcode150

Supported pace:
- relaxed
- moderate
- intensive

Supported topics:
Arrays, Hashing, Two Pointers, Sliding Window, Binary Search, Linked List, Trees, Heap, Stack, Queue, Recursion, Backtracking, Graphs, Dynamic Programming, Greedy, Math

Rules:
- If duration is not mentioned, use 30 days.
- If pace is not mentioned, use moderate.
- If source is not mentioned, use neetcode150.
- If user says exam/test/midterm/busy, add busyDays if date is clear. Current year is ${new Date().getFullYear()}.
- Use weekdayLoad/weekendLoad:
  relaxed = 1.5 / 2.5
  moderate = 2 / 3
  intensive = 3 / 4.5
- bufferDay default is 0 for Sunday.
- loadReduction:
  light busy day = 0.3
  normal busy day = 0.5
  exam day = 0.7

Return JSON in this shape:
{
  "source": "neetcode150",
  "durationDays": 30,
  "pace": "moderate",
  "weekdayLoad": 2,
  "weekendLoad": 3,
  "focusTopics": [],
  "avoidTopics": [],
  "busyDays": [
    {
      "date": "YYYY-MM-DD",
      "reason": "string",
      "loadReduction": 0.5
    }
  ],
  "bufferDay": 0
}`;

    try {
      const { geminiGenerate } = await import('../../utils/geminiClient');
      const rawText = await geminiGenerate(
        { contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nStudent prompt: "${prompt}"` }] }] },
        { temperature: 0.1, responseMimeType: 'application/json' }
      );

      if (!rawText) {
        return heuristicParse(prompt);
      }

      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        source: 'neetcode150',
        durationDays: Math.min(180, Math.max(7, Number(parsed.durationDays) || 30)),
        pace: ['relaxed', 'moderate', 'intensive'].includes(parsed.pace) ? parsed.pace : 'moderate',
        weekdayLoad: Number(parsed.weekdayLoad) || 2.0,
        weekendLoad: Number(parsed.weekendLoad) || 3.0,
        focusTopics: Array.isArray(parsed.focusTopics) ? parsed.focusTopics : [],
        avoidTopics: Array.isArray(parsed.avoidTopics) ? parsed.avoidTopics : [],
        busyDays: Array.isArray(parsed.busyDays) ? parsed.busyDays : [],
        bufferDay: typeof parsed.bufferDay === 'number' ? parsed.bufferDay : 0,
      };
    } catch (err) {
      logger.error('Gemini plan parser exception, falling back to heuristic:', err);
      return heuristicParse(prompt);
    }
  },
};
