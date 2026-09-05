const PLATFORM: Record<string, string> = {
  leetcode: 'LeetCode',
  gfg: 'GFG',
  geeksforgeeks: 'GFG',
  interviewbit: 'InterviewBit',
  codeforces: 'Codeforces',
  codechef: 'CodeChef',
  hackerrank: 'HackerRank',
  atcoder: 'AtCoder',
  spoj: 'SPOJ',
  custom: 'Custom',
};

export function platformLabel(p?: string | null): string {
  if (!p) return '';
  const k = p.trim().toLowerCase();
  return PLATFORM[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

export const SOURCE_LABEL: Record<string, string> = {
  coderarmy: 'Coder Army Sheet',
  coderarmy700: 'Coder Army Sheet',
  neetcode150: 'NeetCode 150',
};
