// ─── Enums ───
export { TaskStatus } from './enums/TaskStatus';
export { TaskType } from './enums/TaskType';
export { Difficulty } from './enums/Difficulty';
export { Rating } from './enums/Rating';
export { Platform } from './enums/Platform';

// ─── Types ───
export type { User, UserProfile } from './types/User';
export type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskWithRevisions,
} from './types/Task';
export type {
  Assignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from './types/Assignment';
export type {
  Plan,
  CreatePlanInput,
  GeneratePlanInput,
  ParsedPlanInput,
  TopicAllocation,
} from './types/Plan';
export type { Revision } from './types/Revision';
export type { Note, CreateNoteInput, UpdateNoteInput } from './types/Note';
export type {
  HeatmapDay,
  TopicProgressItem,
  StreakInfo,
  ProgressSummary,
} from './types/Progress';
export type {
  Timetable,
  ClassSchedule,
  FreeSlot,
} from './types/Timetable';

// ─── Constants ───
export { REVISION_RULES, BACKLOG_EXPIRY_DAYS } from './constants/revisionRules';
export { DSA_TOPICS } from './constants/topics';
export type { DSATopic } from './constants/topics';
