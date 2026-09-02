export interface Revision {
  id: string;
  parentTaskId: string;
  revisionTaskId: string;
  revisionNumber: number;
  scheduledDate: Date;
  status: 'pending' | 'completed' | 'expired';
  completedAt: Date | null;
  createdAt: Date;
}
