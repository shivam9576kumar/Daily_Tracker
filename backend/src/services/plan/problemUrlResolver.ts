import { QuestionBankEntry, normalizePlanSource, isGfgUrlValidAndEquivalent } from './questionBankLoader';
import { resolvePlatformValue } from '../../utils/platform';
import striverGfgMapping from '../../data/striverGfgMapping.json';

const striverMappings = striverGfgMapping as Record<string, any>;

export function resolveQuestionUrl(
  question: QuestionBankEntry,
  source: string
): string {
  const canonicalSource = normalizePlanSource(source);
  if (canonicalSource === 'striver') {
    const mapping = striverMappings[question.id];
    if (question.gfgUrl && isGfgUrlValidAndEquivalent(question, mapping)) {
      return question.gfgUrl;
    }
  }
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
