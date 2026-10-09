export type BookingStep =
  | "service"
  | "barber"
  | "date"
  | "time"
  | "contacts"
  | "done";

export type SlotsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; slots: string[] }
  | { status: "empty" }
  | { status: "error"; message: string };

export type BookingDraft = {
  serviceId: string | null;
  barberId: string | null;
  date: string | null;
  time: string | null;
  name: string;
  phone: string;
};

export const STEP_ORDER: BookingStep[] = [
  "service",
  "barber",
  "date",
  "time",
  "contacts",
  "done",
];

export const STEP_LABELS: Record<Exclude<BookingStep, "done">, string> = {
  service: "Услуга",
  barber: "Барбер",
  date: "Дата",
  time: "Время",
  contacts: "Контакты",
};

export function createInitialDraft(): BookingDraft {
  return {
    serviceId: null,
    barberId: null,
    date: null,
    time: null,
    name: "",
    phone: "",
  };
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 12;
}

export function isValidName(value: string): boolean {
  return value.trim().length >= 2;
}
