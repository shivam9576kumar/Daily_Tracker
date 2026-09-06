const STOP = new Set([
  'a', 'an', 'the', 'of', 'in', 'to', 'for', 'and', 'or', 'with', 'without',
  'using', 'problem', 'problems', 'learn', 'theory', 'do', 'it', 'on', 'at',
  'by', 'from', 'is', 'are'
]);

const ALIAS: Record<string, string> = {
  djisktra: 'dijkstra',
  warshal: 'warshall',
  paranthesis: 'parenthesis',
  sudoko: 'sudoku',
  segrregate: 'segregate',
  unirected: 'undirected',
  stars: 'stairs',
};

export function titleTokens(title: string): string[] {
  let s = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\|?\s*\(\s*dp\s*-?\s*\d+\s*\)/g, ' ');
  s = s.replace(/[’'`]/g, '');
  s = s.replace(/[^a-z0-9]+/g, ' ');
  return s
    .split(' ')
    .filter(Boolean)
    .map((t) => ALIAS[t] ?? t)
    .filter((t) => !STOP.has(t));
}

export function titleCompatible(candidate: string, expected: string[]): boolean {
  const cand = new Set(titleTokens(candidate));
  return expected.some((e) => {
    const exp = titleTokens(e);
    if (exp.length === 0) return false;
    const hit = exp.filter((t) => cand.has(t)).length;
    return hit / exp.length >= 0.8;
  });
}
