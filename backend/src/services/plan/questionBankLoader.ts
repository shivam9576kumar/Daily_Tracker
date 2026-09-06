import neetcodeSample from '../../data/neetcodeSample.json';
import coderArmySheet from '../../data/coderArmySheet.json';
import striverSheet from '../../data/striverSheet.json';
import { ValidationError } from '../../utils/error';
import { resolvePlatformValue } from '../../utils/platform';
import { resolveGfgUrlForQuestion } from './striverGfgMap';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankEntry {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  url: string;
  sourceUrl?: string;
  gfgUrl?: string;
  gfgTitle?: string;
  order: number;
  tags?: string[];
}

export function normalizePlanSource(source: string = 'neetcode150'): string {
  const lower = (source || '').toLowerCase().trim();
  if (lower === 'striver' || lower === 'strivera2z' || lower === 'takeuforward') {
    return 'striver';
  }
  if (lower === 'coderarmy' || lower === 'coderarmy700') {
    return 'coderarmy';
  }
  if (lower === 'neetcode150' || lower === 'neetcode') {
    return 'neetcode150';
  }
  return lower;
}

export function loadQuestionBank(source: string = 'neetcode150'): QuestionBankEntry[] {
  const canonicalSource = normalizePlanSource(source);
  let rawQuestions: QuestionBankEntry[];

  if (canonicalSource === 'neetcode150') {
    rawQuestions = neetcodeSample as QuestionBankEntry[];
  } else if (canonicalSource === 'coderarmy') {
    rawQuestions = coderArmySheet as QuestionBankEntry[];
  } else if (canonicalSource === 'striver') {
    rawQuestions = (striverSheet as QuestionBankEntry[]).map((q) => {
      const gfg = resolveGfgUrlForQuestion(q);
      if (gfg) {
        return {
          ...q,
          url: gfg,
          sourceUrl: q.url,
          gfgUrl: gfg,
          tags: [...(q.tags ?? []), 'gfg', 'striver'],
        };
      }
      return {
        ...q,
        sourceUrl: q.url,
      };
    });
  } else {
    throw new ValidationError(`Unsupported source: "${source}". Supported sources are "neetcode150", "coderarmy", and "striver".`);
  }

  return rawQuestions
    .filter((q) => q.id && q.title && q.topic && q.difficulty)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getOriginalQuestionUrl(question: QuestionBankEntry): string {
  return question.sourceUrl || question.url;
}

export function getPreferredQuestionUrl(question: QuestionBankEntry, source: string): string {
  return question.url;
}

export function getPreferredQuestionPlatform(question: QuestionBankEntry, source: string): string {
  const canonicalSource = normalizePlanSource(source);
  const preferredUrl = getPreferredQuestionUrl(question, source);
  const fallbackPlatform = canonicalSource === 'striver' ? 'striver' : 'custom';
  return resolvePlatformValue(preferredUrl, fallbackPlatform);
}

export function getTopicCount(questions: QuestionBankEntry[], topic: string): number {
  return questions.filter((q) => q.topic.toLowerCase() === topic.toLowerCase()).length;
}

export function getAvailableTopics(questions: QuestionBankEntry[]): string[] {
  return [...new Set(questions.map((q) => q.topic))];
}
