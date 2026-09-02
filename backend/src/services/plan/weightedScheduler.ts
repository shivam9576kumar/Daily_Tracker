import { QuestionBankEntry } from './questionBankLoader';
import { DailyCapacity } from './capacityCalculator';
import { getDifficultyLoad } from './difficultyWeights';

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
  focusTopics?: string[];
  avoidTopics?: string[];
  weekdayLoad: number;
  weekendLoad: number;
}): SchedulerResult {
  const {
    source,
    questions: rawQuestions,
    capacities,
    focusTopics = [],
    avoidTopics = [],
    weekdayLoad,
    weekendLoad,
  } = params;

  const warnings: string[] = [];
  const errors: string[] = [];

  const focusSet = new Set(focusTopics.map((t) => t.toLowerCase().trim()));
  const avoidSet = new Set(avoidTopics.map((t) => t.toLowerCase().trim()));

  // 1. Filter out avoid topics if requested, unless it leaves too few questions
  let filtered = rawQuestions.filter((q) => !avoidSet.has(q.topic.toLowerCase().trim()));
  if (avoidSet.size > 0 && filtered.length < rawQuestions.length) {
    if (filtered.length < 5) {
      warnings.push('Avoid topics was too restrictive; included some avoided topics to ensure a complete plan.');
      filtered = [...rawQuestions];
    } else {
      warnings.push(`Excluded ${rawQuestions.length - filtered.length} questions matching avoid topics.`);
    }
  }

  // 2. Sort questions: Focus topics first, then preserve original topic/difficulty and order
  const questionsToSchedule = [...filtered].sort((a, b) => {
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
      // Find the best combination of questions from remainingPool
      // Max load allowed today = targetCapacity + 0.5
      const maxAllowedLoad = targetCapacity + 0.5;
      let hardCountToday = 0;

      // Greedy selection with heuristic scoring
      let madeProgress = true;
      while (madeProgress && remainingPool.length > 0) {
        madeProgress = false;
        let bestCandidateIdx = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < remainingPool.length; i++) {
          const cand = remainingPool[i];
          const candLoad = getDifficultyLoad(cand.difficulty);

          // Check if adding exceeds maxAllowedLoad
          if (currentDayLoad + candLoad > maxAllowedLoad) {
            continue;
          }

          // Check hard question limit (max 1 hard per day unless capacity >= 3.0)
          if (cand.difficulty === 'hard') {
            if (hardCountToday >= 1 && targetCapacity < 3.0) {
              continue;
            }
            if (day.isBufferDay || (day.busyReason && targetCapacity < 1.5)) {
              // Strongly avoid hard on buffer/busy days
              continue;
            }
          }

          // Heuristic score
          let score = 100;

          // 1. Distance to target capacity
          const newLoad = currentDayLoad + candLoad;
          const distToTarget = Math.abs(targetCapacity - newLoad);
          score -= distToTarget * 30;

          // 2. Topic rotation bonus (different from last task today and yesterday)
          const candTopic = cand.topic.toLowerCase().trim();
          if (candTopic === lastTopicUsed) {
            score -= 25;
          }
          if (dayQuestions.some((dq) => dq.question.topic.toLowerCase().trim() === candTopic)) {
            score -= 35;
          }

          // 3. Focus topic bonus
          if (focusSet.has(candTopic)) {
            score += 40;
          }

          // 4. Balanced mix bonus: if we already have an Easy, prefer Medium over another Easy
          if (dayQuestions.length > 0 && dayQuestions.some((dq) => dq.question.difficulty === 'easy') && cand.difficulty === 'medium') {
            score += 15;
          }

          // 5. Order bonus: preserve original source order
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

          // If we reached or slightly exceeded target capacity, we can stop for this day
          if (currentDayLoad >= targetCapacity) {
            break;
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

  // 3. If remaining questions were not scheduled, try a second pass filling days up to capacityLoad + 0.5
  if (remainingPool.length > 0) {
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
