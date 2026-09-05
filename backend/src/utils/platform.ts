const PLATFORM_HOST_MAP: [string, string][] = [
  ['leetcode.com', 'leetcode'],
  ['geeksforgeeks.org', 'gfg'],
  ['interviewbit.com', 'interviewbit'],
  ['codingninjas.com', 'codingninjas'],
  ['naukri.com/code360', 'codingninjas'],
  ['codeforces.com', 'codeforces'],
  ['hackerrank.com', 'hackerrank'],
  ['codechef.com', 'codechef'],
];

export function platformFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const [fragment, value] of PLATFORM_HOST_MAP) {
    if (lower.includes(fragment)) return value;
  }
  return null;
}

/** URL-derived platform wins; explicit value is fallback. */
export function resolvePlatformValue(
  problemUrl?: string | null,
  explicit?: string | null,
): string {
  return platformFromUrl(problemUrl) ?? explicit ?? 'custom';
}
