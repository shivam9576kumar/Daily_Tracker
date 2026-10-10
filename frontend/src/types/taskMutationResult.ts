import type { Task } from '@dsa-planner/shared';

export interface TaskMutationResult {
  task: Task;
  coinsDelta: number;
}
