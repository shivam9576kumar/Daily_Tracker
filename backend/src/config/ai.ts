import { env } from './env';

/** AI is available only when BOTH a key and a model are configured. */
export function isAiEnabled(e: typeof env = env): boolean {
  return e.GEMINI_API_KEY.trim().length > 0 && e.GEMINI_MODEL.trim().length > 0;
}

/** Human-readable reasons AI is disabled, logged once at startup. */
export function aiConfigWarnings(e: typeof env = env): string[] {
  if (!e.GEMINI_API_KEY.trim()) {
    return ['AI planner disabled: GEMINI_API_KEY is not set'];
  }
  if (!e.GEMINI_MODEL.trim()) {
    return ['AI planner disabled: GEMINI_MODEL is not set (choose one from the Gemini ListModels API)'];
  }
  return [];
}
