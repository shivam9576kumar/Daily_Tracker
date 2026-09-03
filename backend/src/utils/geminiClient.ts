import { GoogleGenerativeAI, type GenerateContentRequest } from '@google/generative-ai';
import { env } from '../config/env';
import logger from './logger';

/**
 * Calls Gemini with the primary model, falling back through GEMINI_MODEL_FALLBACKS
 * on 404 (deprecated model). Next deprecation = change the .env, not the code.
 */
export async function geminiGenerate(
  request: GenerateContentRequest,
  options?: { temperature?: number; responseMimeType?: string }
): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured in .env');
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const candidates = [env.GEMINI_MODEL, ...env.GEMINI_MODEL_FALLBACKS];
  const uniqueCandidates = Array.from(new Set(candidates));

  let lastError: Error | null = null;

  for (const modelName of uniqueCandidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: options?.temperature ?? 0.1,
          ...(options?.responseMimeType
            ? { responseMimeType: options.responseMimeType }
            : {}),
        },
      });

      const result = await model.generateContent(request);
      const text = result.response.text();

      if (modelName !== env.GEMINI_MODEL) {
        logger.info(`Gemini fallback succeeded with model: ${modelName}`);
      }

      return text;
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      const isDeprecated =
        msg.includes('404') ||
        msg.includes('no longer available') ||
        msg.includes('deprecated') ||
        msg.includes('not found');

      if (isDeprecated) {
        logger.warn(`Gemini model deprecated: ${modelName}. Trying next.`);
        lastError = err;
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error('All Gemini models failed');
}
