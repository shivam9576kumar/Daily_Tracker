import neetcodeSample from '../../data/neetcodeSample.json';
import { ValidationError } from '../../utils/error';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankEntry {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  url: string;
  order: number;
  tags?: string[];
}

export function loadQuestionBank(source: string = 'neetcode150'): QuestionBankEntry[] {
  if (source !== 'neetcode150') {
    throw new ValidationError(`Unsupported source: "${source}". Currently only "neetcode150" is supported.`);
  }

  const rawQuestions = neetcodeSample as QuestionBankEntry[];

  return rawQuestions
    .filter((q) => q.id && q.title && q.topic && q.difficulty)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}
