import prisma from '../src/config/database';
import { resolveTimeZone, todayKey, taskScheduleForKey, isValidDateKey } from '../src/utils/dateKeys';
import logger from '../src/utils/logger';

interface RepairAction {
  taskId: string;
  userId: string;
  oldState: {
    status: string;
    isBacklog: boolean;
    backlogSince: Date | null;
    isExpired: boolean;
    scheduledDateKey: string | null;
  };
  proposedState: {
    status?: string;
    isBacklog?: boolean;
    backlogSince?: Date | null;
    isExpired?: boolean;
    scheduledDate?: Date | null;
    scheduledDateKey?: string | null;
  };
  reason: string;
}

interface AmbiguousRow {
  taskId: string;
  userId: string;
  reason: string;
  details: Record<string, any>;
}

export async function runRepairTaskLifecycle(options: { apply?: boolean; userId?: string } = {}) {
  const isApply = !!options.apply;
  const targetUserId = options.userId;

  console.log(`\n=== Task Lifecycle Repair Script ===`);
  console.log(`Mode: ${isApply ? 'APPLY (changes will be saved)' : 'DRY-RUN (no changes will be made)'}`);
  if (targetUserId) console.log(`Target User ID: ${targetUserId}`);
  console.log(`===================================\n`);

  const whereClause: any = targetUserId ? { userId: targetUserId } : {};
  const tasks = await prisma.task.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          timezone: true,
          cp31Enabled: true,
          cp31Band: true,
        },
      },
    },
  });

  const actions: RepairAction[] = [];
  const ambiguous: AmbiguousRow[] = [];

  for (const t of tasks) {
    const tz = resolveTimeZone(t.user.timezone);
    const today = todayKey(tz);

    // Check for ambiguous completion timestamp inconsistencies
    if (t.status === 'completed' && !t.completedAt) {
      ambiguous.push({
        taskId: t.id,
        userId: t.userId,
        reason: 'Status is completed but completedAt is null',
        details: { status: t.status, completedAt: t.completedAt },
      });
      continue;
    }
    if (t.status !== 'completed' && t.completedAt !== null) {
      ambiguous.push({
        taskId: t.id,
        userId: t.userId,
        reason: 'Status is not completed but completedAt is set',
        details: { status: t.status, completedAt: t.completedAt },
      });
      continue;
    }

    // Check malformed non-null scheduling keys
    if (t.scheduledDateKey !== null && t.scheduledDateKey !== '' && !isValidDateKey(t.scheduledDateKey)) {
      ambiguous.push({
        taskId: t.id,
        userId: t.userId,
        reason: 'Scheduled date key is malformed',
        details: { scheduledDateKey: t.scheduledDateKey },
      });
      continue;
    }

    // Repair Case 1: Completed task with contradictory backlog/expiry flags
    if (t.status === 'completed') {
      if (t.isBacklog !== false || t.backlogSince !== null || t.isExpired !== false) {
        actions.push({
          taskId: t.id,
          userId: t.userId,
          oldState: {
            status: t.status,
            isBacklog: t.isBacklog,
            backlogSince: t.backlogSince,
            isExpired: t.isExpired,
            scheduledDateKey: t.scheduledDateKey,
          },
          proposedState: {
            isBacklog: false,
            backlogSince: null,
            isExpired: false,
          },
          reason: 'Completed task contains contradictory backlog/expiry flags',
        });
      }
      continue;
    }

    // Repair Case 2: Personal Inbox task (undated personal task) with backlog/expiry flags or wrong status
    if (t.taskType === 'personal' && (t.scheduledDateKey === null || t.scheduledDateKey === '')) {
      if (t.status !== 'pending' || t.isBacklog !== false || t.backlogSince !== null || t.isExpired !== false) {
        actions.push({
          taskId: t.id,
          userId: t.userId,
          oldState: {
            status: t.status,
            isBacklog: t.isBacklog,
            backlogSince: t.backlogSince,
            isExpired: t.isExpired,
            scheduledDateKey: t.scheduledDateKey,
          },
          proposedState: {
            status: 'pending',
            isBacklog: false,
            backlogSince: null,
            isExpired: false,
            scheduledDate: null,
            scheduledDateKey: null,
          },
          reason: 'Personal Inbox task has improper backlog/expiry status or flags',
        });
      }
      continue;
    }

    // Repair Case 3: Unsolved CP31 task incorrectly marked backlog/expired by generic maintenance
    if (t.taskType === 'cp31' && (t.status === 'backlog' || t.status === 'expired' || t.isBacklog || t.isExpired)) {
      const activeBand =
        t.user.cp31Enabled &&
        t.user.cp31Band !== null &&
        t.cp31ProblemId?.startsWith(`cp31-${t.user.cp31Band}-`) === true;

      const schedule = activeBand ? taskScheduleForKey(today, tz) : { scheduledDate: null, scheduledDateKey: null };

      actions.push({
        taskId: t.id,
        userId: t.userId,
        oldState: {
          status: t.status,
          isBacklog: t.isBacklog,
          backlogSince: t.backlogSince,
          isExpired: t.isExpired,
          scheduledDateKey: t.scheduledDateKey,
        },
        proposedState: {
          status: 'pending',
          isBacklog: false,
          backlogSince: null,
          isExpired: false,
          scheduledDate: schedule.scheduledDate,
          scheduledDateKey: schedule.scheduledDateKey,
        },
        reason: activeBand
          ? 'CP31 task in active band was improperly marked backlog/expired by generic maintenance'
          : 'CP31 task in inactive/disabled band was improperly marked backlog/expired by generic maintenance',
      });
      continue;
    }

    // Repair Case 4: Ordinary status === 'backlog' row with missing isBacklog flag
    if (t.status === 'backlog' && (!t.isBacklog || t.isExpired)) {
      if (t.scheduledDateKey && isValidDateKey(t.scheduledDateKey) && t.scheduledDateKey < today) {
        actions.push({
          taskId: t.id,
          userId: t.userId,
          oldState: {
            status: t.status,
            isBacklog: t.isBacklog,
            backlogSince: t.backlogSince,
            isExpired: t.isExpired,
            scheduledDateKey: t.scheduledDateKey,
          },
          proposedState: {
            isBacklog: true,
            isExpired: false,
            backlogSince: t.backlogSince ?? t.updatedAt ?? t.createdAt,
          },
          reason: 'Backlog status row with missing isBacklog flag or invalid isExpired flag',
        });
      } else {
        ambiguous.push({
          taskId: t.id,
          userId: t.userId,
          reason: 'Backlog status row without overdue scheduling key',
          details: { status: t.status, scheduledDateKey: t.scheduledDateKey, today },
        });
      }
      continue;
    }

    // POTD task checks
    if (t.taskType === 'potd' && (t.status === 'backlog' || t.isBacklog)) {
      ambiguous.push({
        taskId: t.id,
        userId: t.userId,
        reason: 'POTD task marked as backlog (may require POTD domain inspection)',
        details: { status: t.status, isBacklog: t.isBacklog, potdDateKey: t.potdDateKey },
      });
      continue;
    }
  }

  console.log(`Found ${actions.length} repairable actions.`);
  console.log(`Found ${ambiguous.length} ambiguous rows requiring review.\n`);

  for (const act of actions) {
    console.log(`[REPAIR] Task ID: ${act.taskId} (User: ${act.userId})`);
    console.log(`  Reason: ${act.reason}`);
    console.log(`  Old: ${JSON.stringify(act.oldState)}`);
    console.log(`  New: ${JSON.stringify(act.proposedState)}\n`);
  }

  for (const amb of ambiguous) {
    console.log(`[AMBIGUOUS] Task ID: ${amb.taskId} (User: ${amb.userId})`);
    console.log(`  Reason: ${amb.reason}`);
    console.log(`  Details: ${JSON.stringify(amb.details)}\n`);
  }

  if (isApply && actions.length > 0) {
    let appliedCount = 0;
    for (const act of actions) {
      const res = await prisma.task.updateMany({
        where: {
          id: act.taskId,
          userId: act.userId,
          status: act.oldState.status,
          isBacklog: act.oldState.isBacklog,
          isExpired: act.oldState.isExpired,
        },
        data: act.proposedState,
      });
      appliedCount += res.count;
    }
    console.log(`Successfully applied ${appliedCount}/${actions.length} repairs.`);
  }

  return { actionsCount: actions.length, ambiguousCount: ambiguous.length };
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const userArg = args.find((a) => a.startsWith('--userId='));
  const userId = userArg ? userArg.split('=')[1] : undefined;

  runRepairTaskLifecycle({ apply, userId })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Repair script failed:', err);
      process.exit(1);
    });
}
