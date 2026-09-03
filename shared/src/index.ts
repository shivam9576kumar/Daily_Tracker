/**
 * Spaced repetition schedule based on difficulty rating.
 * Numbers represent days AFTER completion when revision is due.
 */
export const REVISION_RULES = {
  easy: [14, 28], // 2 revisions
  medium: [1, 3, 7, 14], // 4 revisions
  hard: [1, 3, 7, 14, 28], // 5 revisions
} as const;

export const BACKLOG_EXPIRY_DAYS = 7;

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = 'easy' | 'medium' | 'hard';
export type TaskType = 'new' | 'revision' | 'assignment';
export type TaskStatus = 'pending' | 'completed' | 'backlog' | 'expired';
export type Platform =
  | 'leetcode'
  | 'coderarmy'
  | 'striver'
  | 'neetcode'
  | 'gfg'
  | 'custom';

// ─── Enums / Constants / Additional Types ───
export { DSA_TOPICS } from './constants/topics';
export type { DSATopic } from './constants/topics';
export type { User, UserProfile } from './types/User';
export type { Task, CreateTaskInput, UpdateTaskInput, TaskWithRevisions } from './types/Task';
export type { Assignment, CreateAssignmentInput, UpdateAssignmentInput } from './types/Assignment';
export type { Plan, CreatePlanInput, GeneratePlanInput, ParsedPlanInput, TopicAllocation } from './types/Plan';
export type { Revision } from './types/Revision';
export type { Note, CreateNoteInput, UpdateNoteInput } from './types/Note';
export type { HeatmapDay, TopicProgressItem, StreakInfo, ProgressSummary } from './types/Progress';
export type { ClassSchedule } from './types/ClassSchedule';
