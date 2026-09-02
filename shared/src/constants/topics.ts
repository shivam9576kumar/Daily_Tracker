/**
 * Canonical list of DSA topics used across the application.
 * Used for tagging tasks, filtering, progress tracking, and AI plan generation.
 */
export const DSA_TOPICS = [
  'Arrays',
  'Strings',
  'Linked List',
  'Stack',
  'Queue',
  'Hashing',
  'Recursion',
  'Backtracking',
  'Sorting',
  'Searching',
  'Binary Search',
  'Two Pointers',
  'Sliding Window',
  'Greedy',
  'Dynamic Programming',
  'Trees',
  'Binary Trees',
  'Binary Search Trees',
  'Heaps',
  'Tries',
  'Graphs',
  'BFS',
  'DFS',
  'Topological Sort',
  'Shortest Path',
  'Union Find',
  'Segment Trees',
  'Bit Manipulation',
  'Math',
  'Matrix',
  'Intervals',
  'Monotonic Stack',
  'Design',
] as const;

export type DSATopic = (typeof DSA_TOPICS)[number];
