import { QuestionBankEntry, normalizePlanSource } from './questionBankLoader';
import { resolvePlatformValue } from '../../utils/platform';

export function resolveQuestionUrl(
  question: QuestionBankEntry,
  source: string
): string {
  return question.url;
}

export function resolveQuestionPlatform(
  question: QuestionBankEntry,
  source: string
): string {
  const canonicalSource = normalizePlanSource(source);
  const url = resolveQuestionUrl(question, source);

  return resolvePlatformValue(
    url,
    canonicalSource === 'striver' ? 'striver' : 'custom'
  );
}
