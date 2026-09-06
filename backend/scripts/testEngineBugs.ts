import { calculateDailyCapacities } from '../src/services/plan/capacityCalculator';
import { scheduleQuestions } from '../src/services/plan/weightedScheduler';
import { planGenerationService } from '../src/services/plan/planGenerationService';
import { QuestionBankEntry } from '../src/services/plan/questionBankLoader';
import { todayKey } from '../src/utils/dateKeys';
import prisma from '../src/config/database';
import { randomUUID } from 'node:crypto';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function makeQ(id: string, title: string, topic: string, difficulty: 'easy' | 'medium' | 'hard', order = 1): QuestionBankEntry {
  return {
    id,
    title,
    topic,
    difficulty,
    order,
  };
}

async function runTests() {
  console.log('🚀 Running Plan Scheduling Engine Bug Verification (BUG 18, 19, 20)...');

  // =========================================================================
  // TEST 1: BUG 20 — Sunday + 60% exam (busy day priority over buffer day)
  // =========================================================================
  console.log('Testing Test 1: BUG 20 (Sunday + 60% exam)...');
  // 2026-09-06 is Sunday (dayOfWeek 0)
  const cap1 = calculateDailyCapacities({
    startDate: '2026-09-06',
    durationDays: 1,
    weekdayLoad: 2.0,
    weekendLoad: 3.0,
    bufferDay: 0,
    busyDays: [{ date: '2026-09-06', reason: 'Exam', loadReduction: 0.6 }],
  });

  // weekendLoad 3.0 * (1 - 0.6) = 1.2 -> rounded to nearest 0.5 = 1.0
  assert(cap1[0].capacityLoad === 1.0, `Capacity should be 1.0, got ${cap1[0].capacityLoad}`);
  assert(cap1[0].busyReason === 'Exam', 'busyReason set');
  console.log('✅ Test 1 passed');

  // =========================================================================
  // TEST 2: BUG 20 — Sunday only (no busy day)
  // =========================================================================
  console.log('Testing Test 2: BUG 20 (Sunday buffer day, no busy day)...');
  const cap2 = calculateDailyCapacities({
    startDate: '2026-09-06',
    durationDays: 1,
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
    bufferDay: 0,
  });

  // weekendLoad 2.0 * 0.3 = 0.6 -> rounded to nearest 0.5 = 0.5
  assert(cap2[0].capacityLoad === 0.5, `Capacity should be 0.5, got ${cap2[0].capacityLoad}`);
  console.log('✅ Test 2 passed');

  // =========================================================================
  // TEST 3: BUG 20 — Busy day on non-buffer day
  // =========================================================================
  console.log('Testing Test 3: BUG 20 (Busy day on Wednesday)...');
  // 2026-09-09 is Wednesday (dayOfWeek 3)
  const cap3 = calculateDailyCapacities({
    startDate: '2026-09-09',
    durationDays: 1,
    weekdayLoad: 2.0,
    weekendLoad: 3.0,
    bufferDay: 0,
    busyDays: [{ date: '2026-09-09', reason: 'Project', loadReduction: 0.5 }],
  });

  // weekdayLoad 2.0 * 0.5 = 1.0
  assert(cap3[0].capacityLoad === 1.0, `Capacity should be 1.0, got ${cap3[0].capacityLoad}`);
  console.log('✅ Test 3 passed');

  // =========================================================================
  // TEST 4: BUG 19 — Sequential mode, Hard on capacity 0.5
  // =========================================================================
  console.log('Testing Test 4: BUG 19 (Sequential Hard on capacity 0.5)...');
  const cap4 = calculateDailyCapacities({
    startDate: '2026-09-07',
    durationDays: 1,
    weekdayLoad: 0.5,
    weekendLoad: 0.5,
  });
  const res4 = scheduleQuestions({
    source: 'custom',
    questions: [makeQ('q1', 'Hard Q', 'DP', 'hard')],
    capacities: cap4,
    weekdayLoad: 0.5,
    weekendLoad: 0.5,
    scheduleMode: 'sequential',
  });

  assert(res4.days[0].questions.length === 1, 'Hard question placed on capacity 0.5');
  assert(res4.days[0].usedLoad === 1.5, `usedLoad should be 1.5, got ${res4.days[0].usedLoad}`);
  console.log('✅ Test 4 passed');

  // =========================================================================
  // TEST 5: BUG 19 — Sequential mode, Hard on zero-capacity day (Option B >=)
  // =========================================================================
  console.log('Testing Test 5: BUG 19 (Sequential Hard on zero capacity day)...');
  const cap5 = [{
    date: '2026-09-07',
    dayOfWeek: 1,
    capacityLoad: 0.0,
    isWeekend: false,
    isBufferDay: false,
    busyReason: 'No Study Day',
  }];
  const res5 = scheduleQuestions({
    source: 'custom',
    questions: [makeQ('q1', 'Hard Q', 'DP', 'hard')],
    capacities: cap5,
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
    scheduleMode: 'sequential',
  });

  assert(res5.days[0].questions.length === 0, 'Hard question SKIPPED on zero-capacity day with >= check');
  console.log('✅ Test 5 passed');

  // =========================================================================
  // TEST 6: BUG 19 — Sequential mode, Easy on zero-capacity day
  // =========================================================================
  console.log('Testing Test 6: BUG 19 (Sequential Easy on zero capacity day)...');
  const res6 = scheduleQuestions({
    source: 'custom',
    questions: [makeQ('q1', 'Easy Q', 'DP', 'easy')],
    capacities: cap5,
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
    scheduleMode: 'sequential',
  });

  assert(res6.days[0].questions.length === 1, 'Easy question placed on zero-capacity day in sequential mode');
  console.log('✅ Test 6 passed');

  // =========================================================================
  // TEST 7: BUG 18 — Second pass does not stack Hards
  // =========================================================================
  console.log('Testing Test 7: BUG 18 (Second pass Hard limit)...');
  const cap7 = calculateDailyCapacities({
    startDate: '2026-09-07',
    durationDays: 1,
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
  });
  const res7 = scheduleQuestions({
    source: 'custom',
    questions: [
      makeQ('h1', 'Hard 1', 'Arrays', 'hard', 1),
      makeQ('h2', 'Hard 2', 'Trees', 'hard', 2),
      makeQ('h3', 'Hard 3', 'Graphs', 'hard', 3),
      makeQ('h4', 'Hard 4', 'DP', 'hard', 4),
    ],
    capacities: cap7,
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
    scheduleMode: 'balanced',
  });

  const hardsOnDay = res7.days[0].questions.filter((q) => q.question.difficulty === 'hard').length;
  assert(hardsOnDay <= 1, `Day should have max 1 Hard, got ${hardsOnDay}`);
  console.log('✅ Test 7 passed');

  // =========================================================================
  // TEST 8: BUG 18 — Second pass respects topic rotation
  // =========================================================================
  console.log('Testing Test 8: BUG 18 (Second pass topic rotation)...');
  const cap8 = calculateDailyCapacities({
    startDate: '2026-09-07',
    durationDays: 1,
    weekdayLoad: 1.0,
    weekendLoad: 1.0,
  });
  // Day capacity 1.0; pass 1 places 1 Medium (1.0).
  // Pass 2 has relaxedMax = 2.0. Pool has [Stack Medium, Heap Medium].
  // If first item placed in pass 1 was Stack, pass 2 must prefer Heap.
  const res8 = scheduleQuestions({
    source: 'custom',
    questions: [
      makeQ('s1', 'Stack 1', 'Stack', 'medium', 1),
      makeQ('s2', 'Stack 2', 'Stack', 'medium', 2),
      makeQ('h1', 'Heap 1', 'Heap', 'medium', 3),
    ],
    capacities: cap8,
    weekdayLoad: 1.0,
    weekendLoad: 1.0,
    scheduleMode: 'balanced',
  });

  assert(res8.days[0].questions.length === 2, '2 questions scheduled total across pass 1 & 2');
  assert(res8.days[0].questions[0].question.topic === 'Stack', 'First question is Stack');
  assert(res8.days[0].questions[1].question.topic === 'Heap', 'Second question is Heap due to topic rotation penalty');
  console.log('✅ Test 8 passed');

  // =========================================================================
  // TEST 9: BUG 18 — Second pass respects focus topics
  // =========================================================================
  console.log('Testing Test 9: BUG 18 (Second pass focus topic boost)...');
  const cap9 = calculateDailyCapacities({
    startDate: '2026-09-07',
    durationDays: 1,
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
  });
  const res9 = scheduleQuestions({
    source: 'custom',
    questions: [
      makeQ('q1', 'General 1', 'General', 'medium', 1),
      makeQ('q2', 'Greedy 1', 'Greedy', 'medium', 2),
      makeQ('q3', 'DP 1', 'DP', 'medium', 3),
    ],
    capacities: cap9,
    topicQuotas: [
      { topic: 'General', count: 1 },
      { topic: 'Greedy', count: 1 },
      { topic: 'DP', count: 1 },
    ],
    focusTopics: ['DP'],
    weekdayLoad: 2.0,
    weekendLoad: 2.0,
    scheduleMode: 'balanced',
  });

  console.log('Test 9 Scheduled Topics:', res9.days[0].questions.map(q => q.question.topic));
  assert(res9.days[0].questions[0].question.topic === 'DP', 'DP (focus topic) scheduled first in pass 1');
  assert(res9.days[0].questions.length > 1 && res9.days[0].questions[1].question.topic !== 'DP', 'Second question is non-focus');
  console.log('✅ Test 9 passed');

  // =========================================================================
  // TEST 10: BUG 18 — Second pass skips buffer days for Hard questions
  // =========================================================================
  console.log('Testing Test 10: BUG 18 (Second pass Hard exclusion on buffer day)...');
  const cap10 = [{
    date: '2026-09-06',
    dayOfWeek: 0,
    capacityLoad: 1.0,
    isWeekend: true,
    isBufferDay: true,
  }];
  const res10 = scheduleQuestions({
    source: 'custom',
    questions: [
      makeQ('e1', 'Easy 1', 'Arrays', 'easy', 1),
      makeQ('h1', 'Hard 1', 'DP', 'hard', 2),
    ],
    capacities: cap10,
    weekdayLoad: 1.0,
    weekendLoad: 1.0,
    scheduleMode: 'balanced',
  });

  const hasHardOnBuffer = res10.days[0].questions.some((q) => q.question.difficulty === 'hard');
  assert(!hasHardOnBuffer, 'Hard question blocked on buffer day during both passes');
  assert(res10.days[0].questions.some((q) => q.question.difficulty === 'easy'), 'Easy question scheduled on buffer day');
  console.log('✅ Test 10 passed');

  // =========================================================================
  // TEST 11: Full Integration Plan Generation
  // =========================================================================
  console.log('Testing Test 11: Full Integration Plan Generation...');
  const testUserId = randomUUID();
  await prisma.user.create({
    data: {
      id: testUserId,
      googleId: `google-${testUserId}`,
      email: `test-${testUserId}@example.com`,
      name: 'Integration Test User',
    },
  });

  const planRes = await planGenerationService.commitPlan(testUserId, {
    source: 'neetcode150',
    startDate: '2026-09-10',
    durationDays: 14,
    pace: 'moderate',
    weekdayLoad: 2.0,
    weekendLoad: 3.0,
    topicQuotas: [
      { topic: 'Arrays & Hashing', count: 10 },
      { topic: 'Two Pointers', count: 5 },
    ],
    busyDays: [
      { date: '2026-09-13', reason: 'Exam 1', loadReduction: 0.6 },
      { date: '2026-09-17', reason: 'Exam 2', loadReduction: 0.6 },
    ],
  });

  assert(planRes.tasksCreated > 0, 'Tasks created for integration plan');
  const dbTasks = await prisma.task.findMany({ where: { planId: planRes.plan.id } });

  // Group by date
  const byDate = new Map<string, typeof dbTasks>();
  for (const t of dbTasks) {
    const key = t.scheduledDateKey;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(t);
  }

  for (const [dateKey, dayTasks] of byDate.entries()) {
    const hards = dayTasks.filter((t) => t.difficulty === 'hard');
    assert(hards.length <= 1, `Date ${dateKey} has ${hards.length} hards (max 1 expected)`);
  }

  // Cleanup test user
  await prisma.user.delete({ where: { id: testUserId } });
  console.log('✅ Test 11 passed');

  console.log('\n🎉 ALL 11 VERIFICATION TEST SUITES PASSED CLEANLY FOR BUG 18, 19, 20!');
}

runTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
