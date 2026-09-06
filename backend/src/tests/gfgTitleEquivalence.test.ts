import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { titlesAreEquivalent, FORCE_REJECT } from '../services/plan/gfgTitleEquivalence';
import striverSheetData from '../data/striverSheet.json';
import striverGfgMappingData from '../data/striverGfgMapping.v1.backup.json';

interface StriverQuestion {
  id: string;
  title: string;
  url: string;
}

interface MappingRecord {
  gfgUrl: string;
  gfgTitle: string;
  status?: string;
  equivalenceVerified?: boolean;
}

const striverSheet = striverSheetData as StriverQuestion[];
const striverMapping = striverGfgMappingData as Record<string, MappingRecord>;

export function runEquivalenceUnitTests() {
  console.log('Running Title Equivalence Unit & Mapping Integrity Tests...');

  // 1. MUST FAIL EQUIVALENCE (7 Known False Positives + Conflicts)
  const FALSE_POSITIVE_PAIRS: [string, string, string?][] = [
    ['Print all Divisors', 'Armstrong Numbers', 'striver-013'],
    ['Check for Prime', 'Sum of first n terms', 'striver-014'],
    ['Print name N times using recursion', 'Minimum Jumps', 'striver-015'],
    ['Print N to 1 using recursion', 'Find all factorial numbers less than or equal to n', 'striver-016'],
    ['Hashing Theory', 'Selection Sort', 'striver-021'],
    ['Counting frequencies of array elements', 'Bubble Sort', 'striver-022'],
    ['Selection Sort', 'Insertion Sort', 'striver-024'],
    ['The Celebrity Problem', 'Word Break'],
    ['Rod Cutting Problem', 'Minimum cost to connect sticks'],
  ];

  for (const [striverT, gfgT, id] of FALSE_POSITIVE_PAIRS) {
    const isEquivalent = titlesAreEquivalent(striverT, gfgT, id);
    assert.strictEqual(
      isEquivalent,
      false,
      `EXPECTED REJECTION FAILED for pair: "${striverT}" vs "${gfgT}" (id: ${id || 'none'})`
    );
  }
  console.log('✔ Test 1: All 9 known false positive pairs correctly REJECTED');

  // 2. MUST PASS EQUIVALENCE (Known True Matches)
  const TRUE_POSITIVE_PAIRS: [string, string][] = [
    ['Count Digits', 'Count Digits'],
    ['Topo Sort', 'Topological Sort'],
    ["Dijkstra's Algorithm", 'Implementing Dijkstra Algorithm'],
    ['Bellman Ford Algorithm', 'Distance from the Source (Bellman-Ford Algorithm)'],
    ['Floyd Warshal Algorithm', 'Floyd Warshall'],
    ['Rod Cutting Problem | (DP - 24)', 'Rod Cutting'],
    ['Longest Common Substring | (DP - 27)', 'Longest Common Substring'],
    ['Frog Jump(DP-3)', 'Geek Jump'],
    ["Ninja's Training (DP 7)", "Geek's Training"],
    ['Count palindromic subsequence in given string', 'Count Palindromic Subsequences'],
  ];

  for (const [striverT, gfgT] of TRUE_POSITIVE_PAIRS) {
    const isEquivalent = titlesAreEquivalent(striverT, gfgT);
    assert.strictEqual(
      isEquivalent,
      true,
      `EXPECTED PASS FAILED for true pair: "${striverT}" vs "${gfgT}"`
    );
  }
  console.log('✔ Test 2: All 10 known true positive pairs correctly PASSED');

  // 3. MAPPING INTEGRITY AUDIT TEST
  const verifiedEntries = Object.entries(striverMapping).filter(
    ([_, record]) => record.status === 'verified'
  );

  for (const [id, record] of verifiedEntries) {
    // A. ID must not be in FORCE_REJECT
    assert.strictEqual(
      FORCE_REJECT.has(id),
      false,
      `Integrity violation: FORCE_REJECT ID '${id}' is marked status=verified`
    );

    // B. Record must have equivalenceVerified = true
    assert.strictEqual(
      record.equivalenceVerified,
      true,
      `Integrity violation: ID '${id}' has status=verified but equivalenceVerified is not true`
    );

    // C. Host must be geeksforgeeks.org
    const parsed = new URL(record.gfgUrl);
    assert.ok(
      parsed.hostname === 'geeksforgeeks.org' || parsed.hostname === 'www.geeksforgeeks.org',
      `Integrity violation: ID '${id}' GFG URL domain is invalid: ${record.gfgUrl}`
    );

    // D. Title equivalence must pass
    const question = striverSheet.find((q) => q.id === id);
    assert.ok(question, `Integrity violation: Striver question ID '${id}' not found in sheet`);

    const equivalent = titlesAreEquivalent(question!.title, record.gfgTitle, id);
    assert.strictEqual(
      equivalent,
      true,
      `Integrity violation: ID '${id}' ("${question!.title}") failed title equivalence against GFG title ("${record.gfgTitle}")`
    );
  }

  console.log(`✔ Test 3: Mapping integrity verified for all ${verifiedEntries.length} status=verified entries`);
  console.log('\nAll title equivalence and integrity unit tests PASSED successfully!');
}

if (require.main === module) {
  runEquivalenceUnitTests();
}
