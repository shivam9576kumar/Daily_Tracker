export interface ClassSchedule {
  id: string;
  userId: string;
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
