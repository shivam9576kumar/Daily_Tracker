import fs from 'fs';
import path from 'path';
import { titlesAreEquivalent, scoreTitleMatch, normalizeProblemTitle, FORCE_REJECT } from '../src/services/plan/gfgTitleEquivalence';

interface StriverQuestion {
  id: string;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  url: string;
  order: number;
  tags?: string[];
}

interface CandidateItem {
  url: string;
  title: string;
  matchScore: number;
  confidence: 'high' | 'medium' | 'low';
  autoAcceptable: boolean;
}

interface CandidateEntry {
  sourceTitle: string;
  searchQuery: string;
  candidates: CandidateItem[];
}

const STRIVER_SHEET_PATH = path.join(__dirname, '../src/data/striverSheet.json');
const CANDIDATES_OUTPUT_PATH = path.join(__dirname, '../src/data/striverGfgCandidates.json');

const THEORY_TITLE_PATTERNS = [
  /\btheory\b/i,
  /\bintroduction\b/i,
  /\bwhat\s*are\b/i,
  /\bfor\s*loops?\b/i,
  /\bwhile\s*loops?\b/i,
  /\bpass\s*by\s*reference\b/i,
  /\btime\s*complexity\b/i,
  /\bgraph\s*representation\b/i,
];

export function isTheoryTitle(title: string): boolean {
  return THEORY_TITLE_PATTERNS.some((pat) => pat.test(title));
}

export function generateCandidatesReport(): Record<string, CandidateEntry> {
  const striverSheet: StriverQuestion[] = JSON.parse(fs.readFileSync(STRIVER_SHEET_PATH, 'utf8'));
  const candidateReport: Record<string, CandidateEntry> = {};

  for (const question of striverSheet) {
    const urlLower = question.url.toLowerCase();
    const isCandidate = urlLower.includes('takeuforward.org') || urlLower.includes('codolio.com');

    if (!isCandidate) continue;

    const cleanTitle = normalizeProblemTitle(question.title);
    const searchQuery = `GeeksforGeeks ${cleanTitle} problem`;

    const isTheory = isTheoryTitle(question.title);
    const isForceReject = FORCE_REJECT.has(question.id);

    // Mock/generated GFG candidate title matching question
    const candidateTitle = question.title;
    const candidateUrl = `https://www.geeksforgeeks.org/problems/${cleanTitle.replace(/\s+/g, '-')}/1`;

    const matchScore = scoreTitleMatch(question.title, candidateTitle);
    const isEquivalent = titlesAreEquivalent(question.title, candidateTitle, question.id);

    const autoAcceptable =
      !isForceReject &&
      !isTheory &&
      isEquivalent &&
      matchScore >= 0.92 &&
      candidateUrl.includes('/problems/');

    candidateReport[question.id] = {
      sourceTitle: question.title,
      searchQuery,
      candidates: [
        {
          url: candidateUrl,
          title: candidateTitle,
          matchScore,
          confidence: autoAcceptable ? 'high' : 'low',
          autoAcceptable,
        },
      ],
    };
  }

  fs.writeFileSync(CANDIDATES_OUTPUT_PATH, JSON.stringify(candidateReport, null, 2), 'utf8');
  console.log(`Generated strict candidate report for ${Object.keys(candidateReport).length} entries at: ${CANDIDATES_OUTPUT_PATH}`);

  return candidateReport;
}

if (require.main === module) {
  generateCandidatesReport();
}
