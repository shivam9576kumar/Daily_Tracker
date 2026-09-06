import prisma from '../src/config/database';

async function main() {
  const isApply = process.argv.includes('--apply');
  console.log(`--- ASSIGNMENT TASK CLEANUP SCRIPT (${isApply ? 'APPLY MODE' : 'DRY-RUN MODE'}) ---`);

  const assignmentTasks = await prisma.task.findMany({
    where: { taskType: 'assignment' },
    select: { id: true, userId: true, title: true, status: true, scheduledDate: true },
  });

  console.log(`Found ${assignmentTasks.length} Task row(s) with taskType='assignment'.`);

  if (assignmentTasks.length === 0) {
    console.log('✅ No dead assignment task rows found in database.');
    return;
  }

  console.table(
    assignmentTasks.map((t) => ({
      ID: t.id,
      User: t.userId,
      Title: t.title,
      Status: t.status,
      ScheduledDate: t.scheduledDate.toISOString().slice(0, 10),
    }))
  );

  if (!isApply) {
    console.log('\n⚠️ DRY-RUN COMPLETE. No rows were deleted or modified.');
    console.log('To clean up these rows (convert to taskType="new"), run: npx tsx scripts/cleanupAssignmentTasks.ts --apply');
    return;
  }

  console.log(`\nConverting ${assignmentTasks.length} row(s) to taskType='new'...`);
  const result = await prisma.task.updateMany({
    where: { taskType: 'assignment' },
    data: { taskType: 'new' },
  });

  console.log(`✅ Successfully updated ${result.count} task row(s) to taskType='new'.`);
}

main()
  .catch((e) => {
    console.error('Cleanup Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
