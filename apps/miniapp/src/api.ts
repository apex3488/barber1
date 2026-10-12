import { getInitData } from "./telegram";

const API_ORIGIN = import.meta.env.VITE_API_URL
  ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
  : "";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
};

export type Barber = {
  id: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  experienceYears: number;
};

export type Booking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  totalDurationMin: number;
  manageToken: string;
  barber: { id: string; name: string; photoUrl: string | null };
  services: Array<{
    serviceId: string | null;
    name: string;
    durationMin: number;
    price: number;
  }>;
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");
  if (init?.auth !== false) {
    const initData = getInitData();
    if (initData) headers.set("X-Telegram-Init-Data", initData);
  }

  const url = API_ORIGIN ? `${API_ORIGIN}${path}` : path;
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    let code = "HTTP_ERROR";
    try {
      const body = (await response.json()) as {
        message?: string;
        code?: string;
      };
      if (body.message) message = body.message;
      if (body.code) code = body.code;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, code, message);
  }
  return response.json() as Promise<T>;
}

export async function fetchServices() {
  const res = await request<{ data: Service[] }>("/api/v1/services", {
    auth: false,
  });
  return res.data;
}

export async function fetchBarbers() {
  const res = await request<{ data: Barber[] }>("/api/v1/barbers", {
    auth: false,
  });
  return res.data;
}

export async function fetchAvailabilityDays(
  serviceIds: string[],
  barberId: string,
) {
  const q = new URLSearchParams({
    serviceIds: serviceIds.join(","),
    barberId,
  });
  const res = await request<{ data: { days: string[] } }>(
    `/api/v1/availability/days?${q}`,
    { auth: false },
  );
  return res.data.days;
}

export async function fetchSlots(
  serviceIds: string[],
  barberId: string,
  date: string,
) {
  const q = new URLSearchParams({
    serviceIds: serviceIds.join(","),
    barberId,
    date,
  });
  const res = await request<{ data: { slots: string[] } }>(
    `/api/v1/availability?${q}`,
    { auth: false },
  );
  return res.data.slots;
}

export async function authTelegram(phone?: string) {
  const res = await request<{
    data: {
      client: { id: string; name: string; phone: string };
      user: { id: number; first_name?: string };
    };
  }>("/api/v1/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData: getInitData(), phone }),
  });
  return res.data;
}

export async function createBooking(input: {
  serviceIds: string[];
  barberId: string;
  startsAt: string;
  client: { name: string; phone: string };
}) {
  const res = await request<{ data: Booking }>("/api/v1/bookings", {
    method: "POST",
    body: JSON.stringify({ ...input, source: "telegram" }),
  });
  return res.data;
}

export async function fetchMyBookings() {
  const res = await request<{ data: Booking[] }>("/api/v1/me/bookings");
  return res.data;
}

export async function cancelBooking(token: string) {
  const res = await request<{ data: Booking }>(
    `/api/v1/bookings/${token}/cancel`,
    { method: "POST" },
  );
  return res.data;
}

export async function rescheduleBooking(token: string, startsAt: string) {
  const res = await request<{ data: Booking }>(
    `/api/v1/bookings/${token}/reschedule`,
    {
      method: "POST",
      body: JSON.stringify({ startsAt }),
    },
  );
  return res.data;
}

export function tashkentToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU").format(price) + " сум";
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
