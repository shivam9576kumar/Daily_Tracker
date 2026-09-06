import neetcodeSample from '../../data/neetcodeSample.json';
import coderArmySheet from '../../data/coderArmySheet.json';
import striverSheet from '../../data/striverSheet.json';
import striverGfgMapping from '../../data/striverGfgMapping.json';
import { ValidationError } from '../../utils/error';
import { resolvePlatformValue } from '../../utils/platform';
import { titlesAreEquivalent, FORCE_REJECT } from './gfgTitleEquivalence';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankEntry {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  url: string;
  gfgUrl?: string;
  gfgTitle?: string;
  order: number;
  tags?: string[];
}

interface GfgMappingRecord {
  gfgUrl: string;
  gfgTitle: string;
  status?: 'verified' | 'rejected';
  equivalenceVerified?: boolean;
}

const striverMappings = striverGfgMapping as Record<string, GfgMappingRecord>;

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

export function isGfgUrlValidAndEquivalent(question: QuestionBankEntry, mapping?: GfgMappingRecord): boolean {
  if (!mapping) return false;
  if (FORCE_REJECT.has(question.id)) return false;
  if (mapping.status !== 'verified') return false;
  if (mapping.equivalenceVerified !== true) return false;
  if (!mapping.gfgUrl || !mapping.gfgTitle) return false;

  try {
    const parsed = new URL(mapping.gfgUrl);
    if (parsed.hostname !== 'geeksforgeeks.org' && parsed.hostname !== 'www.geeksforgeeks.org') {
      return false;
    }
  } catch (err) {
    return false;
  }

  return titlesAreEquivalent(question.title, mapping.gfgTitle, question.id);
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
      const mapping = striverMappings[q.id];
      if (isGfgUrlValidAndEquivalent(q, mapping)) {
        return {
          ...q,
          gfgUrl: mapping.gfgUrl,
          gfgTitle: mapping.gfgTitle,
        };
      }
      return q;
    });
  } else {
    throw new ValidationError(`Unsupported source: "${source}". Supported sources are "neetcode150", "coderarmy", and "striver".`);
  }

  return rawQuestions
    .filter((q) => q.id && q.title && q.topic && q.difficulty)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getOriginalQuestionUrl(question: QuestionBankEntry): string {
  return question.url;
}

export function getPreferredQuestionUrl(question: QuestionBankEntry, source: string): string {
  const canonicalSource = normalizePlanSource(source);
  if (canonicalSource === 'striver' && question.gfgUrl) {
    return question.gfgUrl;
  }
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
