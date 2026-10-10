/**
 * Single canonical entry point for all cross-boundary types, enums, and
 * domain constants. The frontend re-exports from this file (see
 * frontend/src/types/index.ts); the backend imports directly.
 */

// ─── Enums ───
export { Difficulty } from './enums/Difficulty';
export { Platform } from './enums/Platform';
export { Rating } from './enums/Rating';
export { TaskStatus } from './enums/TaskStatus';
export { TaskType } from './enums/TaskType';
export { Recurrence, RECURRENCE_VALUES } from './enums/Recurrence';

// ─── Constants ───
export { REVISION_RULES, BACKLOG_EXPIRY_DAYS } from './constants/revisionRules';
export { DSA_TOPICS } from './constants/topics';
export type { DSATopic } from './constants/topics';

// ─── Domain types ───
export type { Assignment, CreateAssignmentInput, UpdateAssignmentInput } from './types/Assignment';
export type { ClassSchedule } from './types/ClassSchedule';
export type { Note, CreateNoteInput, UpdateNoteInput } from './types/Note';
export type { Plan, CreatePlanInput, GeneratePlanInput, ParsedPlanInput, TopicAllocation } from './types/Plan';
export type { ProgressSummary, HeatmapDay, StreakInfo, TopicProgressItem } from './types/Progress';
export type { Revision } from './types/Revision';
export type { Task, CreateTaskInput, UpdateTaskInput, TaskWithRevisions } from './types/Task';
export type { User, UserProfile } from './types/User';
