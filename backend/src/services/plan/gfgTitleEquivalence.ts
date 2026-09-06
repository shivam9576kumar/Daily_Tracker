export const FORCE_REJECT = new Set([
  'striver-013',
  'striver-014',
  'striver-015',
  'striver-016',
  'striver-021',
  'striver-022',
  'striver-024',
]);

const CONFLICT_PAIRS: [RegExp, RegExp][] = [
  [/\barmstrong\b/, /\bdivisors?\b/],
  [/\bprime\b/, /\b(sum|factorial)\b/],
  [/\bjumps?\b/, /\b(print\s*name|recursion)\b/],
  [/\bselection\s*sort\b/, /\b(insertion|bubble|merge|quick)\s*sort\b/],
  [/\binsertion\s*sort\b/, /\b(selection|bubble|merge|quick)\s*sort\b/],
  [/\bbubble\s*sort\b/, /\b(selection|insertion|merge|quick)\s*sort\b/],
  [/\bmerge\s*sort\b/, /\b(selection|insertion|bubble|quick)\s*sort\b/],
  [/\bquick\s*sort\b/, /\b(selection|insertion|bubble|merge)\s*sort\b/],
  [/\bhashing\b/, /\bsort\b/],
  [/\bfrequenc(y|ies)\b/, /\bbubble\b/],
  [/\brod\s*cutting\b/, /\bconnect\s*sticks\b/],
  [/\bcelebrity\b/, /\bword\s*break\b/],
  [/\bcandy\b/, /\badd\s*revision\b/],
];

const KNOWN_SAFE_ALIASES: [string, string][] = [
  ["kadane's algorithm", "maximum subarray sum"],
  ["2sum problem", "two sum"],
  ["majority element (>n/2 times)", "majority element"],
  ["set matrix zeros", "set matrix zeroes"],
  ["koko eating bananas", "koko eating bananas"],
  ["dijkstra's algorithm", "implementing dijkstra algorithm"],
  ["dijkstra's algorithm", "implementing dijkstra"],
  ["bellman ford algorithm", "distance from the source bellman ford algorithm"],
  ["bellman ford algorithm", "distance from the source"],
  ["bellman ford algorithm", "bellman ford"],
  ["floyd warshall algorithm", "floyd warshall"],
  ["kosaraju's algorithm", "strongly connected components kosarajus algo"],
  ["kosaraju's algorithm", "strongly connected components kosaraju"],
  ["subset sum equal to target", "subset sum problem"],
  ["unbounded knapsack", "knapsack with duplicate items"],
  ["rod cutting problem", "rod cutting"],
  ["longest common substring", "longest common substring"],
  ["longest bitonic subsequence", "longest bitonic subsequence"],
  ["matrix chain multiplication", "matrix chain multiplication"],
  ["count palindromic subsequence", "count palindromic subsequences"],
  ["topological sort", "topo sort"],
  ["kahn's algorithm", "topological sort"],
  ["articulation point", "articulation point"],
  ["frog jump", "geek jump"],
  ["ninja's training", "geek's training"],
  ["ninja's training", "geeks training"],
  ["minimum steps to reach end from start by performing multiplication and mod operations with array elements", "minimum multiplications to reach end"],
  ["minimum multiplications to reach end", "minimum multiplications"],
  ["disjoint set", "disjoint set union find"],
  ["minimum spanning tree", "minimum spanning tree"],
  ["prim's algorithm", "minimum spanning tree"],
  ["kruskal's algorithm", "minimum spanning tree"],
];

export function normalizeProblemTitle(title: string): string {
  if (!title) return '';

  let t = title.normalize('NFKC').toLowerCase();

  // 1. Remove DP suffixes like DP-3, DP 5, DP- 14, |(DP-35)
  t = t.replace(/\(?\bdp\s*[-:\s]?\s*\d+\)?/gi, '');

  // 2. Remove trailing bracket annotations in [] and |
  t = t.replace(/\[.*?\]/g, '');
  t = t.replace(/\|/g, '');

  // Remove parentheses ONLY if they don't contain key algorithmic keywords
  t = t.replace(/\(([^)]*)\)/g, (match, inner) => {
    if (/\b(bellman|dijkstra|ford|warshall|kosaraju|kahn|sort|dp|mst|bfs|dfs)\b/i.test(inner)) {
      return ` ${inner} `;
    }
    return '';
  });

  // 3. Fix known typos & variations
  t = t.replace(/\bparanthesis\b/g, 'parenthesis');
  t = t.replace(/\bsudoko\b/g, 'sudoku');
  t = t.replace(/\bdjisktra('s)?\b/g, 'dijkstra');
  t = t.replace(/\bwarshal\b/g, 'warshall');
  t = t.replace(/\bsegrregate\b/g, 'segregate');
  t = t.replace(/\bunirected\b/g, 'undirected');

  // 4. Expand acronyms
  t = t.replace(/\bdll\b/g, 'doubly linked list');
  t = t.replace(/\bll\b/g, 'linked list');
  t = t.replace(/\bbst\b/g, 'binary search tree');
  t = t.replace(/\bnge\b/g, 'next greater element');
  t = t.replace(/\bmcm\b/g, 'matrix chain multiplication');

  // 5. Strip punctuation & special characters
  t = t.replace(/[^a-z0-9\s]/g, ' ');

  // 6. Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim();

  // 7. Remove filler words ONLY if distinctive tokens remain
  const tokens = t.split(' ');
  const filler = new Set(['problem', 'implementation', 'introduction', 'using', 'theory', 'and', 'with', 'in', 'a', 'the', 'of', 'for', 'to', 'by']);
  const filtered = tokens.filter((tok) => !filler.has(tok));

  if (filtered.length >= 1) {
    return filtered.join(' ');
  }

  return t;
}

export function scoreTitleMatch(striverTitle: string, gfgTitle: string): number {
  const normS = normalizeProblemTitle(striverTitle);
  const normG = normalizeProblemTitle(gfgTitle);

  if (normS === normG) return 1.0;

  // Check known safe aliases
  for (const [aliasA, aliasB] of KNOWN_SAFE_ALIASES) {
    const normA = normalizeProblemTitle(aliasA);
    const normB = normalizeProblemTitle(aliasB);
    if (
      (normS.includes(normA) && normG.includes(normB)) ||
      (normS.includes(normB) && normG.includes(normA)) ||
      (normS === normA && normG === normB) ||
      (normS === normB && normG === normA)
    ) {
      return 0.95;
    }
  }

  // Token Jaccard similarity
  const tokensS = new Set(normS.split(' '));
  const tokensG = new Set(normG.split(' '));

  let intersection = 0;
  tokensS.forEach((tok) => {
    if (tokensG.has(tok)) intersection++;
  });

  const union = new Set([...tokensS, ...tokensG]).size;
  if (union === 0) return 0;

  return intersection / union;
}

export function titlesAreEquivalent(striverTitle: string, gfgTitle: string, striverId?: string): boolean {
  if (striverId && FORCE_REJECT.has(striverId)) {
    return false;
  }

  const normS = normalizeProblemTitle(striverTitle);
  const normG = normalizeProblemTitle(gfgTitle);

  // Check conflicts
  for (const [patternA, patternB] of CONFLICT_PAIRS) {
    const sHasA = patternA.test(normS);
    const gHasB = patternB.test(normG);
    const sHasB = patternB.test(normS);
    const gHasA = patternA.test(normG);

    if ((sHasA && gHasB) || (sHasB && gHasA)) {
      return false;
    }
  }

  // Check known safe aliases
  for (const [aliasA, aliasB] of KNOWN_SAFE_ALIASES) {
    const normA = normalizeProblemTitle(aliasA);
    const normB = normalizeProblemTitle(aliasB);
    if (
      (normS.includes(normA) && normG.includes(normB)) ||
      (normS.includes(normB) && normG.includes(normA))
    ) {
      return true;
    }
  }

  // Jaccard similarity threshold
  const jaccard = scoreTitleMatch(striverTitle, gfgTitle);
  if (jaccard >= 0.55) {
    return true;
  }

  // Substring inclusion fallback for clear title matches
  if (normS.length > 4 && normG.length > 4 && (normS.includes(normG) || normG.includes(normS))) {
    return true;
  }

  return false;
}
