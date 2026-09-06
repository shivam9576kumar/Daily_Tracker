import prisma from '../src/config/database';

async function main() {
  // 1. Repair auto-expired legacy rows before backfilling their date key
  const repairedCount = await prisma.$executeRawUnsafe(`
    UPDATE tasks
    SET status = 'pending',
        is_backlog = false,
        is_expired = false,
        backlog_since = NULL
    WHERE (scheduled_date_key = '' OR scheduled_date_key IS NULL)
      AND is_expired = true
      AND status <> 'completed'
      AND completed_at IS NULL
  `);

  // 2. Backfill invalid/empty scheduled_date_key values using UTC date portion
  const updatedRows = await prisma.$executeRawUnsafe(`
    UPDATE tasks
    SET scheduled_date_key = TO_CHAR(scheduled_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    WHERE scheduled_date_key IS NULL
       OR scheduled_date_key = ''
       OR scheduled_date_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  `);

  // 3. Verify no invalid scheduled_date_key rows remain
  const remaining = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM tasks
    WHERE scheduled_date_key IS NULL
       OR scheduled_date_key = ''
       OR scheduled_date_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  `);

  const remainingInvalidRows = Number(remaining[0]?.count ?? 0);

  console.log(
    JSON.stringify({
      repairedLegacyRows: repairedCount,
      updatedRows,
      remainingInvalidRows,
    })
  );

  if (remainingInvalidRows > 0) {
    throw new Error(
      `scheduledDateKey backfill incomplete: ${remainingInvalidRows} invalid rows remain`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
