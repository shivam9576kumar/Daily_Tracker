export interface Note {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  content: string;
}

export interface UpdateNoteInput {
  content: string;
}
