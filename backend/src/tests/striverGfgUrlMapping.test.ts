import { normalizeQuestionUrl, isTakeUForwardUrl, isGfgUrl } from '../utils/questionUrl';
import { titleTokens, titleCompatible } from '../utils/titleMatch';
import { getStriverGfgMap, resolveGfgUrlForQuestion } from '../services/plan/striverGfgMap';
import { loadQuestionBank } from '../services/plan/questionBankLoader';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('Running Striver → GFG URL Mapping Tests...\n');

  // Test 1: questionUrl normalization & platform checks
  const norm1 = normalizeQuestionUrl('https://takeuforward.org/plus/dsa/problems/selection-sort?utm=codolio&ref=test');
  assert(norm1 === 'takeuforward.org/plus/dsa/problems/selection-sort', 'normalizeQuestionUrl strips tracking query params');
  assert(isTakeUForwardUrl('https://takeuforward.org/plus/dsa/problems/selection-sort'), 'isTakeUForwardUrl identifies TUF');
  assert(isGfgUrl('https://www.geeksforgeeks.org/problems/selection-sort/1'), 'isGfgUrl identifies GFG');

  // Test 2: titleTokens & titleCompatible
  const tokens = titleTokens('Convert min Heap to max Heap (DP - 20)');
  assert(!tokens.includes('dp') && !tokens.includes('20') && !tokens.includes('to'), 'titleTokens removes DP annotations & stop words');
  assert(titleCompatible('Selection Sort', ['Selection Sort']), 'Selection Sort titleCompatible passes');
  assert(!titleCompatible('Hashing Theory', ['Selection Sort']), 'Hashing Theory ≠ Selection Sort');

  // Test 3: striver-229 ("Convert min Heap to max Heap") stays TUF
  const striver229Res = resolveGfgUrlForQuestion({
    title: 'Convert min Heap to max Heap',
    url: 'https://takeuforward.org/plus/dsa/problems/convert-min-heap-to-max-heap?utm=codolio',
  });
  assert(striver229Res === null, 'striver-229 ("Convert min Heap") stays TUF because no mapping entry exists');

  // Test 4: striver-024 ("Selection Sort") resolves to GFG Selection Sort
  const striver024Res = resolveGfgUrlForQuestion({
    title: 'Selection Sort',
    url: 'https://takeuforward.org/plus/dsa/problems/selection-sort?utm=codolio',
  });
  assert(
    striver024Res === 'https://www.geeksforgeeks.org/problems/selection-sort/1',
    'striver-024 ("Selection Sort") resolves to GFG Selection Sort'
  );

  // Test 5: striver-387 ("Rod Cutting") resolves to GFG Rod Cutting
  const striver387Res = resolveGfgUrlForQuestion({
    title: 'Rod Cutting',
    url: 'https://takeuforward.org/plus/dsa/problems/minimum-cost-to-connect-sticks?utm=codolio',
  });
  assert(
    striver387Res === 'https://www.geeksforgeeks.org/problems/rod-cutting0840/1',
    'striver-387 ("Rod Cutting") resolves to GFG Rod Cutting'
  );

  // Test 6: Shared URL title guard: "Connect n ropes" sharing minimum-cost-to-connect-sticks URL should NOT map to Rod Cutting
  const connectRopesRes = resolveGfgUrlForQuestion({
    title: 'Connect n ropes with minimum cost',
    url: 'https://takeuforward.org/plus/dsa/problems/minimum-cost-to-connect-sticks?utm=codolio',
  });
  assert(
    connectRopesRes === null,
    'Connect n ropes sharing minimum-cost-to-connect-sticks URL is excluded by title guard'
  );

  // Test 7: striver-021 ("Hashing Theory") stays TUF
  const striver021Res = resolveGfgUrlForQuestion({
    title: 'Hashing Theory',
    url: 'https://takeuforward.org/hashing/hashing-maps-time-complexity-collisions-division-rule-of-hashing-strivers-a2z-dsa-course/?utm=codolio',
  });
  assert(striver021Res === null, 'striver-021 ("Hashing Theory") stays TUF');

  // Test 8: loadQuestionBank('striver') integration
  const striverBank = loadQuestionBank('striver');
  const selSort = striverBank.find((q) => q.title === 'Selection Sort');
  assert(
    selSort?.url === 'https://www.geeksforgeeks.org/problems/selection-sort/1' &&
      selSort?.sourceUrl === 'https://takeuforward.org/plus/dsa/problems/selection-sort?utm=codolio',
    'loadQuestionBank maps Selection Sort to GFG and preserves sourceUrl'
  );

  const hashTheory = striverBank.find((q) => q.title === 'Hashing Theory');
  assert(
    Boolean(hashTheory?.url && hashTheory.url.includes('takeuforward.org')) && hashTheory?.sourceUrl === hashTheory?.url,
    'loadQuestionBank preserves TUF URL for Hashing Theory'
  );

  console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
