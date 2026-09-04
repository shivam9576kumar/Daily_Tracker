import type {
  AIDraft,
  GeneratePlanPayload,
  PlanSource,
  PlanPace,
  TopicQuota,
  BusyDayInput,
} from '../types';

export function getLocalDateKey(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function draftToPlanPayload(
  draft: AIDraft
): GeneratePlanPayload {
  const hasQuotas = Boolean(draft.topicQuotas?.length);

  return {
    source: (draft.source as PlanSource) || 'neetcode150',
    startDate: draft.startDate || getLocalDateKey(),
    durationDays: draft.durationDays || 30,
    pace: (draft.pace as PlanPace) || 'moderate',
    weekdayLoad: draft.weekdayLoad ?? 2,
    weekendLoad: draft.weekendLoad ?? 3,

    topicQuotas: hasQuotas
      ? draft.topicQuotas ?? undefined
      : undefined,

    // Exact quotas override focus topics.
    focusTopics: hasQuotas
      ? undefined
      : draft.focusTopics ?? undefined,

    avoidTopics: draft.avoidTopics ?? undefined,
    busyDays: draft.busyDays ?? [],
    bufferDay: draft.bufferDay ?? undefined,
    scheduleMode: draft.scheduleMode ?? (draft.topicQuotas?.some((q) => q.all) ? 'sequential' : 'balanced'),
  };
}

function normalizeQuotas(
  quotas?: TopicQuota[],
  preserveOrder: boolean = false
): TopicQuota[] {
  const mapped = [...(quotas ?? [])].map((quota) => ({
    topic: quota.topic.trim().toLowerCase(),
    count: quota.count,
    all: quota.all,
  }));
  return preserveOrder ? mapped : mapped.sort((a, b) => a.topic.localeCompare(b.topic));
}

function normalizeStrings(values?: string[]): string[] {
  return [...(values ?? [])]
    .map((item) => item.trim().toLowerCase())
    .sort();
}

function normalizeBusyDays(
  days?: BusyDayInput[]
): BusyDayInput[] {
  return [...(days ?? [])]
    .map((day) => ({
      date: day.date,
      reason: day.reason?.trim() ?? '',
      loadReduction: day.loadReduction,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function planPayloadFingerprint(
  payload: GeneratePlanPayload
): string {
  const isSequential = payload.scheduleMode === 'sequential';
  return JSON.stringify({
    source: payload.source,
    startDate: payload.startDate,
    durationDays: payload.durationDays,
    pace: payload.pace,
    weekdayLoad: payload.weekdayLoad,
    weekendLoad: payload.weekendLoad,
    scheduleMode: payload.scheduleMode ?? 'balanced',
    topicQuotas: normalizeQuotas(payload.topicQuotas, isSequential),
    focusTopics: normalizeStrings(payload.focusTopics),
    avoidTopics: normalizeStrings(payload.avoidTopics),
    busyDays: normalizeBusyDays(payload.busyDays),
    bufferDay: payload.bufferDay ?? null,
  });
}
