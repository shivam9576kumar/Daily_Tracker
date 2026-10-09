import {
  addDaysToKey,
  assertDateKey,
  todayKey,
} from './dateKeys';
import { ValidationError } from './error';

export type AssignmentUrgency =
  | 'today'
  | 'tomorrow'
  | 'future';

/**
 * Assignment deadlines are all-day dates encoded at UTC midnight.
 * This is intentionally NOT dateKeyInTz(deadline, tz).
 */
export function assignmentDeadlineKey(
  deadline: Date,
): string {
  if (!Number.isFinite(deadline.getTime())) {
    throw new ValidationError('Invalid assignment deadline');
  }

  return assertDateKey(
    deadline.toISOString().slice(0, 10),
    'deadline',
  );
}

export function getAssignmentUrgency(
  deadline: Date,
  tz: string,
  now: Date = new Date(),
): AssignmentUrgency {
  const deadlineKey = assignmentDeadlineKey(deadline);
  const today = todayKey(tz, now);

  // Preserve the existing policy: overdue assignments count
  // in the "today" urgency category.
  if (deadlineKey <= today) {
    return 'today';
  }

  if (deadlineKey === addDaysToKey(today, 1)) {
    return 'tomorrow';
  }

  return 'future';
}
