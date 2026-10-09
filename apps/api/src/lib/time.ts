/** Asia/Tashkent — UTC+5, без DST. */
export const TIMEZONE = "Asia/Tashkent";
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseHhMm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function formatHhMm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Локальные части даты/времени в Asia/Tashkent. */
export function zonedParts(date: Date) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0=вс … 6=сб
  };
}

export function toIsoDateInTz(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** YYYY-MM-DD + HH:mm в Asia/Tashkent → UTC Date */
export function atTashkent(isoDate: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(`${isoDate}T${pad2(h)}:${pad2(m)}:00+05:00`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function weekdayOfIsoDate(isoDate: string): number {
  return zonedParts(atTashkent(isoDate, "12:00")).weekday;
}

export function listIsoDates(from: Date, days: number): string[] {
  const start = toIsoDateInTz(from);
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const base = atTashkent(start, "12:00");
    const next = addMinutes(base, i * 24 * 60);
    result.push(toIsoDateInTz(next));
  }
  return result;
}
