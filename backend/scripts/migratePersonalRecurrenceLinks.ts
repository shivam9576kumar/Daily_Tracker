import prisma from '../src/config/database';

interface Options {
  apply: boolean;
  userId?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply'),
    userId: args
      .find((a) => a.startsWith('--userId='))
      ?.split('=')[1],
  };
}

async function main() {
  const { apply, userId } = parseArgs();

  console.log('=== Personal Recurrence Link Migration ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN (no changes will be made)'}`);
  console.log('===========================================');

  const candidates = await prisma.task.findMany({
    where: {
      taskType: 'personal',
      parentTaskId: { not: null },
      ...(userId ? { userId } : {}),
    },
    select: { id: true, userId: true, parentTaskId: true },
  });

  console.log(`Found ${candidates.length} personal task(s) with legacy parentTaskId.`);

  for (const row of candidates) {
    console.log(
      `  Task ${row.id} (user ${row.userId}): parentTaskId=${row.parentTaskId} -> recurrenceParentId=${row.parentTaskId}, parentTaskId=null`,
    );
  }

  if (!apply) {
    console.log('\nDry-run complete. Re-run with --apply to perform the migration.');
    return;
  }

  for (const row of candidates) {
    await prisma.task.updateMany({
      // Guard against concurrent modification since the dry-run snapshot.
      where: { id: row.id, taskType: 'personal', parentTaskId: row.parentTaskId },
      data: { recurrenceParentId: row.parentTaskId, parentTaskId: null },
    });
  }

  console.log(`\nMigrated ${candidates.length} row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
