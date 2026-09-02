import { create } from 'zustand';

interface DashboardData {
  statusOverview: {
    totalQuestions: number;
    streak: number;
    backlog: number;
    expired: number;
    coins: number;
  };
  vibe: {
    emoji: string;
    message: string;
    intensity: 'none' | 'low' | 'medium' | 'high';
  };
  pendingAssignments: Array<{
    id: string;
    title: string;
    description: string | null;
    deadline: string;
    status: string;
    urgency: 'today' | 'tomorrow' | 'future';
  }>;
  todaysHitlist: {
    pending: Task[];
    completed: Task[];
  };
}

interface Task {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  platform: string;
  problemUrl: string | null;
  taskType: string;
  status: string;
  scheduledDate: string;
  originalSolveDate: string | null;
  completedAt: string | null;
  rating: string | null;
  revisionNumber: number;
  isBacklog: boolean;
  isExpired: boolean;
  notes: string | null;
}

interface TaskStore {
  dashboard: DashboardData | null;
  selectedTask: Task | null;
  isDrawerOpen: boolean;
  isRatingModalOpen: boolean;
  isLoading: boolean;

  setDashboard: (data: DashboardData) => void;
  setSelectedTask: (task: Task | null) => void;
  openDrawer: (task: Task) => void;
  closeDrawer: () => void;
  openRatingModal: () => void;
  closeRatingModal: () => void;
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  dashboard: null,
  selectedTask: null,
  isDrawerOpen: false,
  isRatingModalOpen: false,
  isLoading: false,

  setDashboard: (data) => set({ dashboard: data }),
  setSelectedTask: (task) => set({ selectedTask: task }),
  openDrawer: (task) => set({ selectedTask: task, isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false, selectedTask: null, isRatingModalOpen: false }),
  openRatingModal: () => set({ isRatingModalOpen: true }),
  closeRatingModal: () => set({ isRatingModalOpen: false }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
