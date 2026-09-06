import prisma from '../src/config/database';

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE tasks
    SET scheduled_date_key = TO_CHAR(scheduled_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    WHERE scheduled_date_key IS NULL
       OR scheduled_date_key = ''
  `);

  const remaining = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM tasks
    WHERE scheduled_date_key IS NULL
       OR scheduled_date_key = ''
  `);

  const count = Number(remaining[0]?.count ?? 0);

  console.log(
    JSON.stringify({
      updatedRows: result,
      remainingInvalidRows: count,
    })
  );

  if (count > 0) {
    throw new Error(
      `scheduledDateKey backfill incomplete: ${count} invalid rows remain`
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
