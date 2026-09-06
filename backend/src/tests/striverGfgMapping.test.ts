import assert from 'assert';
import { loadQuestionBank } from '../services/plan/questionBankLoader';
import { resolveQuestionUrl, resolveQuestionPlatform } from '../services/plan/problemUrlResolver';
import { resolvePlatformValue } from '../utils/platform';
import { validateStriverGfgMapping } from '../utils/striverGfgValidator';

export function runStriverGfgTests() {
  console.log('Running Striver -> GFG integration tests...');

  // 1. Data validation audit
  const validation = validateStriverGfgMapping();
  assert.strictEqual(validation.totalQuestions, 435, 'Expected 435 questions');
  assert.deepStrictEqual(validation.errors, [], `Expected 0 validation errors: ${validation.errors.join(', ')}`);
  assert.strictEqual(validation.success, true, 'Expected validation success');
  console.log('✔ Test 1: Data validation audit passed');

  // 2. Loader mapping
  const questions = loadQuestionBank('striver');
  assert.strictEqual(questions.length, 435, 'Expected 435 loaded Striver questions');

  const mappedEntry = questions.find((q) => q.id === 'striver-009');
  assert.ok(mappedEntry, 'striver-009 should exist');
  assert.strictEqual(mappedEntry?.gfgUrl, 'https://www.geeksforgeeks.org/problems/count-digits5716/1');
  assert.strictEqual(mappedEntry?.url, 'https://takeuforward.org/plus/dsa/problems/count-all-digits-of-a-number?utm=codolio');

  const unmappedEntry = questions.find((q) => q.id === 'striver-001');
  assert.ok(unmappedEntry, 'striver-001 should exist');
  assert.strictEqual(unmappedEntry?.gfgUrl, undefined, 'unmapped entry should have undefined gfgUrl');
  console.log('✔ Test 2: Loader mapping passed');

  // 3. URL & Platform resolution
  const mappedQuestion = questions.find((q) => q.id === 'striver-009')!;
  const unmappedQuestion = questions.find((q) => q.id === 'striver-001')!;

  assert.strictEqual(resolveQuestionUrl(mappedQuestion, 'striver'), 'https://www.geeksforgeeks.org/problems/count-digits5716/1');
  assert.strictEqual(resolveQuestionPlatform(mappedQuestion, 'striver'), 'gfg');

  assert.strictEqual(resolveQuestionUrl(unmappedQuestion, 'striver'), 'https://takeuforward.org/plus/dsa/problems/cpp?utm=codolio');
  assert.strictEqual(resolveQuestionPlatform(unmappedQuestion, 'striver'), 'striver');
  console.log('✔ Test 3: URL & Platform resolution passed');

  // 4. External platform links preserved
  const hrQuestion = questions.find((q) => q.id === 'striver-004')!;
  assert.ok(hrQuestion.url.includes('hackerrank.com'));
  assert.strictEqual(resolveQuestionUrl(hrQuestion, 'striver'), hrQuestion.url);
  assert.strictEqual(resolveQuestionPlatform(hrQuestion, 'striver'), 'hackerrank');

  const lcQuestion = questions.find((q) => q.id === 'striver-010')!;
  assert.ok(lcQuestion.url.includes('leetcode.com'));
  assert.strictEqual(resolveQuestionUrl(lcQuestion, 'striver'), lcQuestion.url);
  assert.strictEqual(resolveQuestionPlatform(lcQuestion, 'striver'), 'leetcode');
  console.log('✔ Test 4: External platform links preservation passed');

  // 5. Host mapping checks
  assert.strictEqual(resolvePlatformValue('https://www.geeksforgeeks.org/problems/example/1', 'striver'), 'gfg');
  assert.strictEqual(resolvePlatformValue('https://takeuforward.org/example', 'striver'), 'striver');
  assert.strictEqual(resolvePlatformValue('https://leetcode.com/problems/two-sum', 'striver'), 'leetcode');
  assert.strictEqual(resolvePlatformValue('https://www.interviewbit.com/problems/example', 'striver'), 'interviewbit');
  assert.strictEqual(resolvePlatformValue('https://www.spoj.com/problems/example', 'striver'), 'spoj');
  console.log('✔ Test 5: Platform host resolver passed');

  console.log('\nAll 5 Striver GFG integration test suites PASSED successfully!');
}

if (require.main === module) {
  runStriverGfgTests();
}
