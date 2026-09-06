const PLATFORM: Record<string, string> = {
  leetcode: 'LeetCode',
  gfg: 'GFG',
  geeksforgeeks: 'GFG',
  interviewbit: 'InterviewBit',
  codingninjas: 'Coding Ninjas',
  codeforces: 'Codeforces',
  codechef: 'CodeChef',
  hackerrank: 'HackerRank',
  atcoder: 'AtCoder',
  spoj: 'SPOJ',
  striver: 'Striver (takeuforward)',
  takeuforward: 'Striver (takeuforward)',
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
  striver: "Striver's A2Z Sheet",
  strivera2z: "Striver's A2Z Sheet",
  takeuforward: "Striver's A2Z Sheet",
};
