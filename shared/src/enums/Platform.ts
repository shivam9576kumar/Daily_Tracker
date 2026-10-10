export type Platform =
  | 'leetcode'
  | 'coderarmy'
  | 'striver'
  | 'neetcode'
  | 'gfg'
  | 'codeforces'
  | 'hackerrank'
  | 'custom';

export const Platform = {
  CODERARMY: 'coderarmy' as const,
  STRIVER: 'striver' as const,
  NEETCODE: 'neetcode' as const,
  LEETCODE: 'leetcode' as const,
  GFG: 'gfg' as const,
  CODEFORCES: 'codeforces' as const,
  HACKERRANK: 'hackerrank' as const,
  CUSTOM: 'custom' as const,
};
