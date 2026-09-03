import prisma from '../src/config/database';
import { classesService } from '../src/services/classes/classesService';
import { dashboardService } from '../src/services/dashboard/dashboardService';

async function main() {
  console.log('=== TESTING PHASE 8 FINAL (MINIMAL) ===');

  // Create test user
  let user = await prisma.user.findFirst({ where: { email: 'test_phase8_final@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test_phase8_final_google_id',
        email: 'test_phase8_final@example.com',
        name: 'Phase 8 Final Tester',
      },
    });
  }
  const userId = user.id;

  // Test 1: Empty state
  console.log('\n--- Test 1: Empty State ---');
  await classesService.clear(userId);
  let list = await classesService.list(userId);
  console.log('Initial class count:', list.length);
  if (list.length !== 0) throw new Error('Expected 0 classes');

  // Test 2: Save real timetable (19 rows)
  console.log('\n--- Test 2: Save Real Timetable (19 rows) ---');
  const timetable19 = [
    { dayOfWeek: 1, subject: 'CH3101T', startTime: '09:00', endTime: '09:55', location: 'R-306' },
    { dayOfWeek: 1, subject: 'CH3101', startTime: '10:00', endTime: '10:55', location: 'R-306' },
    { dayOfWeek: 1, subject: 'CH3104', startTime: '11:00', endTime: '11:55', location: 'R-306' },
    { dayOfWeek: 1, subject: 'IDE', startTime: '12:00', endTime: '13:00', location: null },
    { dayOfWeek: 1, subject: 'CH3102', startTime: '14:00', endTime: '14:55', location: 'R-306' },
    { dayOfWeek: 1, subject: 'CH3103', startTime: '15:00', endTime: '15:55', location: 'R-306' },

    { dayOfWeek: 2, subject: 'CH3102', startTime: '14:00', endTime: '14:55', location: 'R-306' },
    { dayOfWeek: 2, subject: 'CH3104', startTime: '15:00', endTime: '15:55', location: 'R-306' },
    { dayOfWeek: 2, subject: 'CH3103', startTime: '16:00', endTime: '16:55', location: 'R-306' },
    { dayOfWeek: 2, subject: 'CH3101', startTime: '17:00', endTime: '17:55', location: 'R-306' },

    { dayOfWeek: 3, subject: 'IDE', startTime: '12:00', endTime: '13:00', location: null },
    { dayOfWeek: 3, subject: 'CH3103', startTime: '15:00', endTime: '15:55', location: 'R-306' },
    { dayOfWeek: 3, subject: 'CH3104', startTime: '16:00', endTime: '16:55', location: 'R-306' },
    { dayOfWeek: 3, subject: 'CH3104T', startTime: '17:00', endTime: '17:55', location: 'R-306' },

    { dayOfWeek: 4, subject: 'CH3102T', startTime: '09:00', endTime: '09:55', location: 'R-306' },
    { dayOfWeek: 4, subject: 'CH3105 Lab', startTime: '14:00', endTime: '17:00', location: 'Lab 2' },

    { dayOfWeek: 5, subject: 'CH3101', startTime: '11:00', endTime: '11:55', location: 'R-306' },
    { dayOfWeek: 5, subject: 'IDE', startTime: '12:00', endTime: '13:00', location: null },
    { dayOfWeek: 5, subject: 'CH3105 Lab', startTime: '14:00', endTime: '17:00', location: 'Lab 2' },
  ];

  const saved19 = await classesService.replaceAll(userId, timetable19);
  console.log('Saved count:', saved19.length);
  if (saved19.length !== 19) throw new Error('Expected 19 classes');

  // Test 3: Full replace semantics (empty array wipes)
  console.log('\n--- Test 3: Full Replace (Empty Array Wipes) ---');
  await classesService.replaceAll(userId, []);
  list = await classesService.list(userId);
  console.log('After empty replace count:', list.length);
  if (list.length !== 0) throw new Error('Expected 0 classes after empty replace');

  // Restore 19 rows
  await classesService.replaceAll(userId, timetable19);

  // Test 4: Overlap rejection (names BOTH subjects)
  console.log('\n--- Test 4: Overlap Rejection ---');
  const badOverlaps = [
    { dayOfWeek: 1, subject: 'Math Class A', startTime: '09:00', endTime: '10:00' },
    { dayOfWeek: 1, subject: 'Physics Class B', startTime: '09:30', endTime: '10:30' },
  ];
  try {
    await classesService.replaceAll(userId, badOverlaps);
    throw new Error('Overlap check failed to reject!');
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    console.log('Caught expected overlap error:', msg);
    if (
      !msg.includes('Overlapping classes') ||
      !msg.includes('Math Class A') ||
      !msg.includes('Physics Class B')
    ) {
      throw new Error('Overlap error message must name BOTH subjects!');
    }
  }

  // Restore 19 rows
  await classesService.replaceAll(userId, timetable19);

  // Test 5: Bad payload rejection
  console.log('\n--- Test 5: Bad Payload Rejection ---');
  try {
    await classesService.replaceAll(userId, [
      { dayOfWeek: 9, subject: 'X', startTime: '09:00', endTime: '10:00' },
    ]);
    throw new Error('Failed to reject invalid dayOfWeek');
  } catch (e: any) {
    console.log('PASS 1 (Invalid dayOfWeek):', e.message);
  }

  try {
    await classesService.replaceAll(userId, [
      { dayOfWeek: 1, subject: '', startTime: '09:00', endTime: '10:00' },
    ]);
    throw new Error('Failed to reject empty subject');
  } catch (e: any) {
    console.log('PASS 2 (Empty subject):', e.message);
  }

  try {
    await classesService.replaceAll(userId, [
      { dayOfWeek: 1, subject: 'X', startTime: '10:00', endTime: '09:00' },
    ]);
    throw new Error('Failed to reject end <= start');
  } catch (e: any) {
    console.log('PASS 3 (End <= Start):', e.message);
  }

  // Test 6: Dashboard payload includes classes
  console.log('\n--- Test 6: Dashboard Aggregate Payload ---');
  const dashData = await dashboardService.getDashboardData(userId, 'Asia/Kolkata');
  console.log('Dashboard classes count:', dashData.classes.length);
  if (dashData.classes.length !== 19) throw new Error('Dashboard must include user classes');

  // Test 7: Data isolation
  console.log('\n--- Test 7: Data Isolation ---');
  let user2 = await prisma.user.findFirst({ where: { email: 'test_phase8_user2@example.com' } });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        googleId: 'test_phase8_user2_google_id',
        email: 'test_phase8_user2@example.com',
        name: 'User 2',
      },
    });
  }
  const listUser2 = await classesService.list(user2.id);
  console.log('User 2 class count:', listUser2.length);
  if (listUser2.length !== 0) throw new Error('User 2 must have 0 classes');

  // Clean up
  console.log('\n--- Cleaning Up Test Data ---');
  await classesService.clear(userId);
  await classesService.clear(user2.id);

  console.log('\n✅ ALL PHASE 8 FINAL TESTS PASSED!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
