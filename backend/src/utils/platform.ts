/** Canonical platform ids used across the app. */
export type PlatformId =
  | 'leetcode'
  | 'gfg'
  | 'interviewbit'
  | 'codeforces'
  | 'codechef'
  | 'hackerrank'
  | 'atcoder'
  | 'spoj'
  | 'custom';

const HOST_MAP: Record<string, PlatformId> = {
  'leetcode.com': 'leetcode',
  'leetcode.cn': 'leetcode',
  'geeksforgeeks.org': 'gfg',
  'practice.geeksforgeeks.org': 'gfg',
  'interviewbit.com': 'interviewbit',
  'codeforces.com': 'codeforces',
  'codechef.com': 'codechef',
  'hackerrank.com': 'hackerrank',
  'atcoder.jp': 'atcoder',
  'spoj.com': 'spoj',
};

/**
 * Derive the platform from a problem URL. This is the single source of truth —
 * the label must always match where the link actually goes.
 * Returns 'custom' when the URL is missing or unrecognised.
 */
export function platformFromUrl(url?: string | null): PlatformId {
  if (!url) return 'custom';
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (HOST_MAP[host]) return HOST_MAP[host];
    // subdomain fallback: practice.geeksforgeeks.org, www2.leetcode.com, etc.
    for (const [key, id] of Object.entries(HOST_MAP)) {
      if (host === key || host.endsWith(`.${key}`)) return id;
    }
    return 'custom';
  } catch {
    return 'custom';
  }
}

/**
 * Optional: use the bank's own tag when the URL is unusable, else fall back to URL.
 * Order matters — URL wins because it is what the user actually clicks.
 */
export function resolvePlatform(url?: string | null, tags?: string[] | null): PlatformId {
  const fromUrl = platformFromUrl(url);
  if (fromUrl !== 'custom') return fromUrl;

  const tag = (tags ?? []).map((t) => t.toLowerCase().trim())[0];
  if (!tag) return 'custom';
  const tagMap: Record<string, PlatformId> = {
    gfg: 'gfg',
    geeksforgeeks: 'gfg',
    leetcode: 'leetcode',
    interviewbit: 'interviewbit',
    codeforces: 'codeforces',
    codechef: 'codechef',
    hackerrank: 'hackerrank',
  };
  return tagMap[tag] ?? 'custom';
}
