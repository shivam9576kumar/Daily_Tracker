import prisma from '../src/config/database';
import { getTodayPotd, ensurePotdTaskForUser } from '../src/services/potd/potdService';

async function run() {
  console.log('=== Step 1: Testing getTodayPotd() ===');
  
  // Clean up any existing POTD cache for a clean test
  await prisma.potdCache.deleteMany();

  const t0 = Date.now();
  const potd1 = await getTodayPotd();
  const d0 = Date.now() - t0;
  console.log(`First call (network): ${d0}ms`);
  console.log('Fetched POTD:', potd1);

  const t1 = Date.now();
  const potd2 = await getTodayPotd();
  const d1 = Date.now() - t1;
  console.log(`Second call (cache): ${d1}ms`);
  console.log('Cached POTD:', potd2);

  const cacheCount = await prisma.potdCache.count();
  console.log(`potdCache count: ${cacheCount} (expected: 1)`);

  console.log('\n=== Step 2: Testing ensurePotdTaskForUser() ===');
  // Find an existing user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'test_potd_google_id',
        email: 'test_potd@example.com',
        name: 'Test User',
      },
    });
    console.log('Created test user:', user.id);
  } else {
    console.log('Using existing user:', user.id, user.email);
  }

  // Clean any previous POTD tasks for this date for this user
  if (potd1) {
    await prisma.task.deleteMany({
      where: { userId: user.id, potdDateKey: potd1.dateKey },
    });
    await prisma.potdDismissal.deleteMany({
      where: { userId: user.id, dateKey: potd1.dateKey },
    });
  }

  // Call ensurePotdTaskForUser 5 times
  for (let i = 1; i <= 5; i++) {
    const res = await ensurePotdTaskForUser(user.id, 'Asia/Kolkata');
    console.log(`Call #${i}: taskId=${res.taskId}, stale=${res.stale}`);
  }

  const tasks = await prisma.task.findMany({
    where: { userId: user.id, potdDateKey: potd1?.dateKey },
    select: {
      id: true,
      title: true,
      taskType: true,
      planId: true,
      potdDateKey: true,
      scheduledDate: true,
    },
  });

  console.log(`\nTasks found with potdDateKey (${potd1?.dateKey}): ${tasks.length} (expected: 1)`);
  console.log('Created Task Row:', JSON.stringify(tasks[0], null, 2));

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
