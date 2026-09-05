import prisma from '../config/database';
import { platformFromUrl } from '../utils/platform';

async function main() {
  const tasks = await prisma.task.findMany({
    where: { problemUrl: { not: null } },
    select: { id: true, platform: true, problemUrl: true },
  });

  let updated = 0;
  const byPlatform: Record<string, number> = {};

  for (const t of tasks) {
    const derived = platformFromUrl(t.problemUrl);
    if (derived && derived !== t.platform) {
      await prisma.task.update({
        where: { id: t.id },
        data: { platform: derived },
      });
      updated++;
      byPlatform[derived] = (byPlatform[derived] ?? 0) + 1;
    }
  }

  console.log(`✅ Platform cleanup complete. Updated ${updated} task(s).`, byPlatform);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
