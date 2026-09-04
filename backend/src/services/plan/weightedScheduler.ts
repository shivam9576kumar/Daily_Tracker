import { QuestionBankEntry } from './questionBankLoader';
import { DailyCapacity } from './capacityCalculator';
import { getDifficultyLoad } from './difficultyWeights';

export type ScheduleMode = 'balanced' | 'sequential';

export interface TopicQuota {
  topic: string;
  count: number;
  all?: boolean;
}

export interface ScheduledQuestion {
  question: QuestionBankEntry;
  scheduledDate: string;
  load: number;
}

export interface DaySchedule {
  date: string;
  dayOfWeek: number;
  capacityLoad: number;
  usedLoad: number;
  isWeekend: boolean;
  isBufferDay: boolean;
  busyReason?: string;
  questions: ScheduledQuestion[];
}

export interface SchedulerResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  summary: {
    source: string;
    totalQuestions: number;
    totalLoad: number;
    totalSelected: number;
    durationDays: number;
    startDate: string;
    endDate: string;
    weekdayLoad: number;
    weekendLoad: number;
    estimatedQuestionsPerDay: number;
  };
  days: DaySchedule[];
}

export function scheduleQuestions(params: {
  source: string;
  questions: QuestionBankEntry[];
  capacities: DailyCapacity[];
  topicQuotas?: TopicQuota[];
  focusTopics?: string[];
  avoidTopics?: string[];
  weekdayLoad: number;
  weekendLoad: number;
  scheduleMode?: ScheduleMode;
}): SchedulerResult {
  const {
    source,
    questions: rawQuestions,
    capacities,
    topicQuotas,
    focusTopics = [],
    avoidTopics = [],
    weekdayLoad,
    weekendLoad,
    scheduleMode = 'balanced',
  } = params;

  const warnings: string[] = [];
  const errors: string[] = [];

  const focusSet = new Set(focusTopics.map((t) => t.toLowerCase().trim()));
  const avoidSet = new Set(avoidTopics.map((t) => t.toLowerCase().trim()));

  let filtered: QuestionBankEntry[] = [];

  if (topicQuotas && topicQuotas.length > 0) {
    // 1. Merge duplicate topics case-insensitively, PRESERVE first-seen order
    const orderedTopics: string[] = [];
    const wanted = new Map<string, { topicName: string; count: number; all: boolean }>();

    for (const q of topicQuotas) {
      if (!q || !q.topic || typeof q.topic !== 'string') continue;
      const key = q.topic.trim().toLowerCase();
      if (!wanted.has(key)) {
        orderedTopics.push(key);
        const matchingQ = rawQuestions.find(
          (raw) => raw.topic.trim().toLowerCase() === key
        );
        const topicName = matchingQ ? matchingQ.topic : q.topic.trim();
        wanted.set(key, { topicName, count: 0, all: false });
      }
      const entry = wanted.get(key)!;
      if (q.all) entry.all = true;
      const count = Math.floor(Number(q.count));
      if (Number.isFinite(count) && count > 0) {
        entry.count += count;
      }
    }

    const selected: QuestionBankEntry[] = [];
    const selectedIds = new Set<string>();

    for (const topicKey of orderedTopics) {
      if (avoidSet.has(topicKey)) {
        warnings.push(`"${topicKey}" is in both selected and avoided; skipped.`);
        continue;
      }
      const want = wanted.get(topicKey)!;
      const pool = rawQuestions.filter(
        (x) => x.topic.trim().toLowerCase() === topicKey && !selectedIds.has(x.id)
      );
      const take = want.all ? pool.length : Math.min(pool.length, want.count);

      if (take < (want.all ? pool.length : want.count)) {
        warnings.push(
          `Only ${take} questions available for ${want.topicName} (requested ${want.count}).`
        );
      }
      const chosen = pool.slice(0, take);
      for (const q of chosen) {
        selectedIds.add(q.id);
        selected.push(q);
      }
    }

    filtered = selected;
    if (filtered.length === 0) {
      errors.push('No questions remain after topic selection and avoid filtering.');
    }
  } else {
    filtered = [...rawQuestions];

    // 1a. If focus topics specified, keep ONLY those topics
    if (focusSet.size > 0) {
      filtered = filtered.filter((q) => focusSet.has(q.topic.toLowerCase().trim()));
      if (filtered.length === 0) {
        warnings.push('No questions matched your focus topics. Including all questions instead.');
        filtered = [...rawQuestions];
      } else {
        warnings.push(`Filtered to ${filtered.length} questions matching focus topics: ${focusTopics.join(', ')}.`);
      }
    }

    // 1b. Filter out avoid topics if requested
    if (avoidSet.size > 0) {
      const before = filtered.length;
      filtered = filtered.filter((q) => !avoidSet.has(q.topic.toLowerCase().trim()));
      if (filtered.length < 5) {
        warnings.push('Avoid topics was too restrictive; included some avoided topics to ensure a complete plan.');
        filtered = focusSet.size > 0
          ? rawQuestions.filter((q) => focusSet.has(q.topic.toLowerCase().trim()))
          : [...rawQuestions];
      } else if (filtered.length < before) {
        warnings.push(`Excluded ${before - filtered.length} questions matching avoid topics.`);
      }
    }
  }

  // 2. Determine initial question sequence to schedule
  const questionsToSchedule =
    scheduleMode === 'sequential'
      ? [...filtered]
      : [...filtered].sort((a, b) => {
          const aFocus = focusSet.has(a.topic.toLowerCase().trim()) ? 1 : 0;
          const bFocus = focusSet.has(b.topic.toLowerCase().trim()) ? 1 : 0;
          if (aFocus !== bFocus) return bFocus - aFocus;
          return (a.order || 0) - (b.order || 0);
        });

  const totalQuestions = questionsToSchedule.length;
  let totalLoad = 0;
  for (const q of questionsToSchedule) {
    totalLoad += getDifficultyLoad(q.difficulty);
  }

  const remainingPool: QuestionBankEntry[] = [...questionsToSchedule];
  const days: DaySchedule[] = [];
  let lastTopicUsed = '';

  for (let dayIdx = 0; dayIdx < capacities.length; dayIdx++) {
    const day = capacities[dayIdx];
    const dayQuestions: ScheduledQuestion[] = [];
    let currentDayLoad = 0;
    const targetCapacity = day.capacityLoad;

    // If capacity is 0 (e.g. heavy busy day / zero capacity day), schedule 0 tasks
    if (targetCapacity > 0 && remainingPool.length > 0) {
      const maxAllowedLoad = targetCapacity + 0.5;

      if (scheduleMode === 'sequential') {
        // Sequential mode: consume remainingPool from the front in strict order
        while (remainingPool.length > 0) {
          const cand = remainingPool[0];
          const candLoad = getDifficultyLoad(cand.difficulty);

          if (currentDayLoad > 0 && currentDayLoad + candLoad > maxAllowedLoad) {
            break;
          }

          const chosen = remainingPool.shift()!;
          currentDayLoad += candLoad;
          dayQuestions.push({
            question: chosen,
            scheduledDate: day.date,
            load: candLoad,
          });

          if (currentDayLoad >= targetCapacity) {
            break;
          }
        }
      } else {
        // Balanced mode: Greedy selection with heuristic scoring & topic rotation
        let hardCountToday = 0;
        let madeProgress = true;
        while (madeProgress && remainingPool.length > 0) {
          madeProgress = false;
          let bestCandidateIdx = -1;
          let bestScore = -Infinity;

          for (let i = 0; i < remainingPool.length; i++) {
            const cand = remainingPool[i];
            const candLoad = getDifficultyLoad(cand.difficulty);

            if (currentDayLoad + candLoad > maxAllowedLoad) {
              continue;
            }

            if (cand.difficulty === 'hard') {
              if (hardCountToday >= 1 && targetCapacity < 3.0) {
                continue;
              }
              if (day.isBufferDay || (day.busyReason && targetCapacity < 1.5)) {
                continue;
              }
            }

            let score = 100;
            const newLoad = currentDayLoad + candLoad;
            const distToTarget = Math.abs(targetCapacity - newLoad);
            score -= distToTarget * 30;

            const candTopic = cand.topic.toLowerCase().trim();
            if (candTopic === lastTopicUsed) {
              score -= 25;
            }
            if (dayQuestions.some((dq) => dq.question.topic.toLowerCase().trim() === candTopic)) {
              score -= 35;
            }

            if (focusSet.has(candTopic)) {
              score += 40;
            }

            if (dayQuestions.length > 0 && dayQuestions.some((dq) => dq.question.difficulty === 'easy') && cand.difficulty === 'medium') {
              score += 15;
            }

            score -= (cand.order || 0) * 0.1;

            if (score > bestScore) {
              bestScore = score;
              bestCandidateIdx = i;
            }
          }

          if (bestCandidateIdx !== -1) {
            const chosen = remainingPool.splice(bestCandidateIdx, 1)[0];
            const chosenLoad = getDifficultyLoad(chosen.difficulty);
            if (chosen.difficulty === 'hard') hardCountToday++;

            currentDayLoad += chosenLoad;
            lastTopicUsed = chosen.topic.toLowerCase().trim();

            dayQuestions.push({
              question: chosen,
              scheduledDate: day.date,
              load: chosenLoad,
            });

            madeProgress = true;

            if (currentDayLoad >= targetCapacity) {
              break;
            }
          }
        }
      }
    }

    days.push({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      capacityLoad: day.capacityLoad,
      usedLoad: currentDayLoad,
      isWeekend: day.isWeekend,
      isBufferDay: day.isBufferDay,
      busyReason: day.busyReason,
      questions: dayQuestions,
    });
  }

  // 3. If remaining questions were not scheduled, try a second pass filling days up to capacityLoad + 0.5 (balanced mode only)
  if (scheduleMode !== 'sequential' && remainingPool.length > 0) {
    for (const day of days) {
      if (remainingPool.length === 0) break;
      if (day.capacityLoad === 0) continue;

      const maxAllowed = day.capacityLoad + 0.5;
      for (let i = 0; i < remainingPool.length; i++) {
        const cand = remainingPool[i];
        const candLoad = getDifficultyLoad(cand.difficulty);
        if (day.usedLoad + candLoad <= maxAllowed) {
          remainingPool.splice(i, 1);
          day.usedLoad += candLoad;
          day.questions.push({
            question: cand,
            scheduledDate: day.date,
            load: candLoad,
          });
          i--;
        }
      }
    }
  }

  // 4. Validate if any questions remain unscheduled
  let valid = true;
  if (remainingPool.length > 0) {
    valid = false;
    errors.push(
      `Not enough capacity. ${remainingPool.length} of ${totalQuestions} questions could not be scheduled. Increase duration or daily load.`
    );
  }

  const durationDays = capacities.length;
  const startDate = capacities[0]?.date || '';
  const endDate = capacities[capacities.length - 1]?.date || '';
  const scheduledCount = totalQuestions - remainingPool.length;
  const estimatedQuestionsPerDay = durationDays > 0 ? Number((scheduledCount / durationDays).toFixed(1)) : 0;

  return {
    valid,
    warnings,
    errors,
    summary: {
      source,
      totalQuestions,
      totalLoad,
      totalSelected: totalQuestions,
      durationDays,
      startDate,
      endDate,
      weekdayLoad,
      weekendLoad,
      estimatedQuestionsPerDay,
    },
    days,
  };
}
