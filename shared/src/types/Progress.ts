export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4; // intensity for coloring
}

export interface TopicProgressItem {
  topic: string;
  total: number;
  completed: number;
  percentage: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export interface ProgressSummary {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  backlogTasks: number;
  expiredTasks: number;
  completionRate: number;
}
