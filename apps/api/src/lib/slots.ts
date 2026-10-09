import { addMinutes, atTashkent, formatHhMm, parseHhMm } from "./time.js";

export type TimeInterval = { startMin: number; endMin: number };

export type BusyInterval = {
  startsAt: Date;
  endsAt: Date;
};

export type SlotComputeInput = {
  isoDate: string;
  durationMin: number;
  workingHours: TimeInterval | null;
  breaks: TimeInterval[];
  busy: BusyInterval[];
  slotStepMin: number;
  now: Date;
  minNoticeMin: number;
};

/** Вычитает busy из free-интервалов. */
export function subtractIntervals(
  free: TimeInterval[],
  busy: TimeInterval[],
): TimeInterval[] {
  let result = [...free];

  for (const block of busy) {
    const next: TimeInterval[] = [];
    for (const slot of result) {
      if (block.endMin <= slot.startMin || block.startMin >= slot.endMin) {
        next.push(slot);
        continue;
      }
      if (block.startMin > slot.startMin) {
        next.push({ startMin: slot.startMin, endMin: block.startMin });
      }
      if (block.endMin < slot.endMin) {
        next.push({ startMin: block.endMin, endMin: slot.endMin });
      }
    }
    result = next;
  }

  return result.filter((item) => item.endMin - item.startMin > 0);
}

export function busyToDayMinutes(
  isoDate: string,
  busy: BusyInterval[],
): TimeInterval[] {
  const dayStart = atTashkent(isoDate, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60);

  return busy
    .map((item) => {
      const start = Math.max(item.startsAt.getTime(), dayStart.getTime());
      const end = Math.min(item.endsAt.getTime(), dayEnd.getTime());
      if (end <= start) return null;
      return {
        startMin: Math.floor((start - dayStart.getTime()) / 60_000),
        endMin: Math.ceil((end - dayStart.getTime()) / 60_000),
      };
    })
    .filter((item): item is TimeInterval => item !== null);
}

export function computeSlotStarts(input: SlotComputeInput): string[] {
  if (!input.workingHours || input.durationMin <= 0) return [];

  let free: TimeInterval[] = [input.workingHours];
  free = subtractIntervals(free, input.breaks);
  free = subtractIntervals(free, busyToDayMinutes(input.isoDate, input.busy));

  const earliest = addMinutes(input.now, input.minNoticeMin);
  const slots: string[] = [];

  for (const interval of free) {
    for (
      let start = interval.startMin;
      start + input.durationMin <= interval.endMin;
      start += input.slotStepMin
    ) {
      const startsAt = atTashkent(input.isoDate, formatHhMm(start));
      if (startsAt < earliest) continue;
      slots.push(formatHhMm(start));
    }
  }

  return slots;
}

export function totalDuration(items: Array<{ durationMin: number }>): number {
  return items.reduce((sum, item) => sum + item.durationMin, 0);
}

export function totalPrice(items: Array<{ price: number }>): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function parseTimeInterval(
  startTime: string,
  endTime: string,
): TimeInterval {
  return {
    startMin: parseHhMm(startTime),
    endMin: parseHhMm(endTime),
  };
}
