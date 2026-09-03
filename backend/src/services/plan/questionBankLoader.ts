import neetcodeSample from '../../data/neetcodeSample.json';
import coderArmySheet from '../../data/coderArmySheet.json';
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
  let rawQuestions: QuestionBankEntry[];

  if (source === 'neetcode150') {
    rawQuestions = neetcodeSample as QuestionBankEntry[];
  } else if (source === 'coderarmy' || source === 'coderarmy700') {
    rawQuestions = coderArmySheet as QuestionBankEntry[];
  } else {
    throw new ValidationError(`Unsupported source: "${source}". Supported sources are "neetcode150" and "coderarmy".`);
  }

  return rawQuestions
    .filter((q) => q.id && q.title && q.topic && q.difficulty)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

