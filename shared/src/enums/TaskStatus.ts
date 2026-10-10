export type TaskStatus = 'pending' | 'completed' | 'backlog' | 'expired' | 'skipped';

export const TaskStatus = {
  PENDING: 'pending' as const,
  COMPLETED: 'completed' as const,
  BACKLOG: 'backlog' as const,
  EXPIRED: 'expired' as const,
  SKIPPED: 'skipped' as const,
};
