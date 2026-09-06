import mappingFile from '../../data/striverGfgMapping.json';
import { normalizeQuestionUrl, isGfgUrl } from '../../utils/questionUrl';
import { titleCompatible } from '../../utils/titleMatch';

export interface GfgMapEntry {
  sourceUrl: string | null;
  gfgUrl: string;
  expectedTitles: string[];
  status: 'verified' | 'review' | 'unmatched' | 'rejected';
  note?: string;
}

interface GfgMapFile {
  version: number;
  entries: Record<string, GfgMapEntry>;
}

const FILE = mappingFile as unknown as GfgMapFile;
let cache: Map<string, GfgMapEntry> | null = null;

export function getStriverGfgMap(): Map<string, GfgMapEntry> {
  if (cache) return cache;
  const m = new Map<string, GfgMapEntry>();
  if (FILE.version !== 2) return m;
  for (const [key, e] of Object.entries(FILE.entries)) {
    if (e.status !== 'verified') continue;
    if (!isGfgUrl(e.gfgUrl)) continue;
    const norm = e.sourceUrl ? normalizeQuestionUrl(e.sourceUrl) : null;
    if (!norm || norm !== key) continue;
    if (!Array.isArray(e.expectedTitles) || e.expectedTitles.length === 0) continue;
    m.set(key, e);
  }
  cache = m;
  return m;
}

export function resolveGfgUrlForQuestion(q: { title: string; url: string }): string | null {
  const normUrl = normalizeQuestionUrl(q.url);
  if (!normUrl || !normUrl.includes('takeuforward.org')) return null;
  const e = getStriverGfgMap().get(normUrl);
  if (!e) return null;
  if (!titleCompatible(q.title, e.expectedTitles)) return null;
  return e.gfgUrl;
}
