export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  coins: number;
  potdEnabled: boolean;
  cp31Enabled: boolean;
  cp31Band: number | null;
  cp31DailyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  coins: number;
}
