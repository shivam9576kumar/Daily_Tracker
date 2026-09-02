export interface Timetable {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  status: 'processing' | 'parsed' | 'error';
}

export interface ClassSchedule {
  id: string;
  timetableId: string;
  userId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  subject: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  location: string | null;
}

export interface FreeSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isBestSlot: boolean;
}
