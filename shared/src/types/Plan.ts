export interface Plan {
  id: string;
  userId: string;
  name: string;
  source: string; // e.g., 'coderarmy', 'striver', 'neetcode', 'custom'
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'archived';
  weekdayCapacity: number;
  weekendCapacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanInput {
  name: string;
  source: string;
  startDate: string;
  endDate: string;
  weekdayCapacity: number;
  weekendCapacity: number;
}

export interface GeneratePlanInput {
  prompt: string; // Natural language prompt for AI
}

export interface ParsedPlanInput {
  topics: TopicAllocation[];
  startDate: string;
  endDate: string;
  weekdayCapacity: number;
  weekendCapacity: number;
  source: string;
}

export interface TopicAllocation {
  name: string;
  count: number;
}
