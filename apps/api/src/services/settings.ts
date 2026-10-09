import { prisma } from "../lib/prisma.js";

const DEFAULTS = {
  cancel_cutoff_min: 30,
  slot_step_min: 15,
  booking_horizon_days: 30,
  min_notice_min: 30,
  timezone: "Asia/Tashkent",
} as const;

export type AppSettings = {
  cancelCutoffMin: number;
  slotStepMin: number;
  bookingHorizonDays: number;
  minNoticeMin: number;
  timezone: string;
};

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const num = (key: keyof typeof DEFAULTS, fallback: number) => {
    const raw = map.get(key);
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    cancelCutoffMin: num("cancel_cutoff_min", DEFAULTS.cancel_cutoff_min),
    slotStepMin: num("slot_step_min", DEFAULTS.slot_step_min),
    bookingHorizonDays: num(
      "booking_horizon_days",
      DEFAULTS.booking_horizon_days,
    ),
    minNoticeMin: num("min_notice_min", DEFAULTS.min_notice_min),
    timezone: map.get("timezone") ?? DEFAULTS.timezone,
  };
}
