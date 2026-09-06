import prisma from '../src/config/database';
import { platformFromUrl } from '../src/utils/platform';

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`--- PLATFORM BACKFILL SCRIPT (${isApply ? 'APPLY MODE' : 'DRY-RUN MODE'}) ---`);

  const tasks = await prisma.task.findMany({
    where: { problemUrl: { not: null } },
    select: { id: true, platform: true, problemUrl: true, title: true },
  });

  console.log(`Inspecting ${tasks.length} task(s) with problem URLs...`);

  const changes: { id: string; title: string; oldPlatform: string; newPlatform: string }[] = [];
  const summaryMap: Record<string, number> = {};

  for (const t of tasks) {
    const derived = platformFromUrl(t.problemUrl);
    if (derived && derived !== t.platform) {
      changes.push({
        id: t.id,
        title: t.title,
        oldPlatform: t.platform,
        newPlatform: derived,
      });
      const key = `${t.platform} -> ${derived}`;
      summaryMap[key] = (summaryMap[key] ?? 0) + 1;
    }
  }

  console.log('\n--- SUMMARY OF DETECTED MISMATCHES ---');
  if (changes.length === 0) {
    console.log('✅ No platform mismatches found. Database is 100% up to date!');
    return;
  }

  console.table(
    Object.entries(summaryMap).map(([transition, count]) => ({
      Transition: transition,
      Count: count,
    }))
  );

  if (!isApply) {
    console.log('\n⚠️ DRY-RUN COMPLETE. No database writes were performed.');
    console.log('To apply these changes, re-run with: npm run backfill:platform -- --apply');
    return;
  }

  console.log(`\nApplying updates to ${changes.length} row(s) in batches of 500...`);
  const BATCH_SIZE = 500;
  let updatedCount = 0;

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const chunk = changes.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      chunk.map((item) =>
        prisma.task.update({
          where: { id: item.id },
          data: { platform: item.newPlatform },
        })
      )
    );
    updatedCount += chunk.length;
    console.log(`  Updated batch ${Math.floor(i / BATCH_SIZE) + 1} (${updatedCount}/${changes.length} rows)`);
  }

  console.log(`\n✅ SUCCESSFULLY BACKFILLED ${updatedCount} TASK PLATFORM ROWS!`);
}

main()
  .catch((e) => {
    console.error('Backfill Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
