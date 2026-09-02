export interface Assignment {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  deadline: Date;
  status: 'pending' | 'completed';
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
