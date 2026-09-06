const TRACKING = /^(utm(_.*)?|ref|source|fbclid|gclid)$/i;

export function normalizeQuestionUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let path = u.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep as-is */
  }
  path = path.replace(/\/+$/, '') || '/';
  const kept: string[] = [];
  u.searchParams.forEach((v, k) => {
    if (!TRACKING.test(k)) kept.push(`${k}=${v}`);
  });
  kept.sort();
  return `${host}${path}${kept.length ? `?${kept.join('&')}` : ''}`;
}

export function isTakeUForwardUrl(raw?: string | null): boolean {
  if (!raw) return false;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '') === 'takeuforward.org';
  } catch {
    return false;
  }
}

export function isGfgUrl(raw?: string | null): boolean {
  if (!raw) return false;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '') === 'geeksforgeeks.org';
  } catch {
    return false;
  }
}
