export type AssignmentUrgency = 'today' | 'tomorrow' | 'future';

export interface Assignment {
  id: string;
  userId?: string;
  title: string;
  description: string | null;
  deadline: string;
  status: 'pending' | 'completed';
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  urgency?: AssignmentUrgency;
}

export interface CreateAssignmentInput {
  title: string;
  description?: string;
  deadline: string; // ISO date string
}

export interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  deadline?: string;
  status?: 'pending' | 'completed';
}
