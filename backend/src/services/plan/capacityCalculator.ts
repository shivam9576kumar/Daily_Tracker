export interface BusyDayInput {
  date: string; // YYYY-MM-DD
  reason?: string;
  loadReduction: number; // e.g. 0.5 means 50% reduction
}

export interface DailyCapacity {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  capacityLoad: number;
  isWeekend: boolean;
  isBufferDay: boolean;
  busyReason?: string;
}

export function calculateDailyCapacities(params: {
  startDate: string;
  durationDays: number;
  weekdayLoad: number;
  weekendLoad: number;
  busyDays?: BusyDayInput[];
  bufferDay?: number; // 0 for Sunday
}): DailyCapacity[] {
  const {
    startDate,
    durationDays,
    weekdayLoad,
    weekendLoad,
    busyDays = [],
    bufferDay = 0,
  } = params;

  const busyMap = new Map<string, BusyDayInput>();
  for (const b of busyDays) {
    if (b.date) {
      busyMap.set(b.date.split('T')[0], b);
    }
  }

  const result: DailyCapacity[] = [];
  const start = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`);

  for (let i = 0; i < durationDays; i++) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);

    const dateStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBufferDay = dayOfWeek === bufferDay;

    let baseLoad = isWeekend ? weekendLoad : weekdayLoad;

    // Buffer day reduction (70% less)
    if (isBufferDay) {
      baseLoad *= 0.3;
    }

    // Busy day reduction
    const busy = busyMap.get(dateStr);
    let busyReason: string | undefined;

    if (busy) {
      busyReason = busy.reason || 'Busy day';
      const factor = Math.max(0, 1 - (busy.loadReduction || 0.5));
      baseLoad *= factor;
    }

    // Round to nearest 0.5 and floor at 0
    let finalCapacity = Math.round(baseLoad * 2) / 2;
    if (finalCapacity < 0) finalCapacity = 0;

    result.push({
      date: dateStr,
      dayOfWeek,
      capacityLoad: finalCapacity,
      isWeekend,
      isBufferDay,
      busyReason,
    });
  }

  return result;
}
