export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export const Recurrence = {
  DAILY: 'daily',
  WEEKDAYS: 'weekdays',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

export const RECURRENCE_VALUES: Recurrence[] = [
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
];
