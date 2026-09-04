/** Canonical key: lowercase, strip non-alphanumerics, strip trailing 's' */
export function topicKey(input: string): string {
  let k = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.endsWith('s') && k.length > 3) k = k.slice(0, -1);
  return k;
}

/** Abbreviation / synonym aliases, keyed by topicKey() output */
const ALIASES: Record<string, string> = {
  dp: 'Dynamic Programming',
  dynamicprogramming: 'Dynamic Programming',
  bst: 'BST',
  binarysearchtree: 'BST',
  linkedlist: 'Linked List',
  linkedlists: 'Linked List',
  hashmap: 'Hashing',
  hashmaps: 'Hashing',
  hashing: 'Hashing',
  string: 'Strings',
  strings: 'Strings',
  searchingandsorting: 'Sorting & Searching',
  sorting: 'Sorting & Searching',
  searching: 'Sorting & Searching',
  sortingandsorting: 'Sorting & Searching',
  twopointer: 'Two Pointers',
  twopointers: 'Two Pointers',
  slidingwindow: 'Sliding Window',
  binarysearch: 'Binary Search',
  bitmanipulation: 'Bit Manipulation',
  bitmagic: 'Bit Manipulation',
  trie: 'Trie',
  tries: 'Trie',
  greedy: 'Greedy',
  recursion: 'Recursion',
  backtracking: 'Backtracking',
  graph: 'Graph',
  graphs: 'Graph',
  tree: 'Binary Tree',
  trees: 'Binary Tree',
  binarytree: 'Binary Tree',
  binarytrees: 'Binary Tree',
  heap: 'Heap',
  heaps: 'Heap',
  stack: 'Stack',
  stacks: 'Stack',
  queue: 'Queue',
  queues: 'Queue',
  array: 'Arrays',
  arrays: 'Arrays',
  math: 'Math',
  segmenttree: 'Segment Tree',
  segmenttrees: 'Segment Tree',
  advancedds: 'Advanced DS',
  advancedd: 'Advanced DS',
};

/**
 * Resolve any user/AI/legacy topic string to the EXACT bank topic name.
 * @param input     e.g. "Trees", "heaps", "DP", "linked list"
 * @param bankTopics real topic names from the question bank
 * @returns exact bank name, or null if truly unknown
 */
export function resolveTopic(input: string, bankTopics: string[]): string | null {
  if (!input || typeof input !== 'string') return null;
  const k = topicKey(input);

  // 1. direct alias
  const alias = ALIASES[k];
  if (alias && bankTopics.some((t) => t === alias)) return alias;

  // 2. exact key match against bank
  const direct = bankTopics.find((t) => topicKey(t) === k);
  if (direct) return direct;

  // 3. alias key match against bank (alias -> key -> bank key)
  if (alias) {
    const viaAlias = bankTopics.find((t) => topicKey(t) === topicKey(alias));
    if (viaAlias) return viaAlias;
  }

  return null;
}
