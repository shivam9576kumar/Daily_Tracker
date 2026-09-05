import prisma from '../config/database';
import { platformFromUrl } from '../utils/platform';

/**
 * Idempotent backfill: sets task.platform to match the host of task.problemUrl.
 * Skips POTD tasks (always genuinely LeetCode) and tasks without a URL.
 */
async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      problemUrl: { not: null },
      taskType: { not: 'potd' },
    },
    select: { id: true, problemUrl: true, platform: true, title: true },
  });

  console.log(`Scanning ${tasks.length} tasks…`);

  let fixed = 0;
  const changes: Record<string, number> = {};

  for (const t of tasks) {
    const correct = platformFromUrl(t.problemUrl);
    if (correct === 'custom') continue;          // don't downgrade unknown URLs
    if (t.platform === correct) continue;        // already right

    await prisma.task.update({
      where: { id: t.id },
      data: { platform: correct },
    });

    const key = `${t.platform} -> ${correct}`;
    changes[key] = (changes[key] ?? 0) + 1;
    fixed++;
  }

  console.log(`Fixed ${fixed} tasks.`);
  console.table(changes);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
