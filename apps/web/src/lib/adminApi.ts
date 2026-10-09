const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/api/v1/admin${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const adminApi = {
  login: (login: string, password: string) =>
    request<{ data: { id: string; login: string } }>("/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    }),
  logout: () => request<{ ok: boolean }>("/logout", { method: "POST" }),
  me: () => request<{ data: { id: string; login: string } }>("/me"),
  bookings: (query = "") =>
    request<{ data: AdminBooking[] }>(`/bookings${query}`),
  createBooking: (body: unknown) =>
    request<{ data: AdminBooking }>("/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchBooking: (id: string, body: unknown) =>
    request<{ data: AdminBooking }>(`/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  services: () => request<{ data: AdminService[] }>("/services"),
  createService: (body: unknown) =>
    request<{ data: AdminService }>("/services", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchService: (id: string, body: unknown) =>
    request<{ data: AdminService }>(`/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteService: (id: string) =>
    request<{ ok: boolean }>(`/services/${id}`, { method: "DELETE" }),
  barbers: () => request<{ data: AdminBarber[] }>("/barbers"),
  createBarber: (body: unknown) =>
    request<{ data: AdminBarber }>("/barbers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchBarber: (id: string, body: unknown) =>
    request<{ data: AdminBarber }>(`/barbers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteBarber: (id: string) =>
    request<{ ok: boolean }>(`/barbers/${id}`, { method: "DELETE" }),
  saveSchedule: (id: string, body: unknown) =>
    request<{ data: AdminBarber }>(`/barbers/${id}/schedule`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ data: AdminBarber }>(`/barbers/${id}/photo`, {
      method: "POST",
      body: form,
    });
  },
  uploadPortfolio: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ data: { id: string; imageUrl: string } }>(
      `/barbers/${id}/portfolio`,
      { method: "POST", body: form },
    );
  },
  deletePortfolio: (barberId: string, itemId: string) =>
    request<{ ok: boolean }>(`/barbers/${barberId}/portfolio/${itemId}`, {
      method: "DELETE",
    }),
  telegramLink: (id: string) =>
    request<{ data: { deepLink: string } }>(`/barbers/${id}/telegram-link`, {
      method: "POST",
    }),
  timeOff: () => request<{ data: AdminTimeOff[] }>("/time-off"),
  createTimeOff: (body: unknown) =>
    request<{ data: AdminTimeOff }>("/time-off", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteTimeOff: (id: string) =>
    request<{ ok: boolean }>(`/time-off/${id}`, { method: "DELETE" }),
  settings: () => request<{ data: Record<string, string> }>("/settings"),
  saveSettings: (body: Record<string, string>) =>
    request<{ data: Record<string, string> }>("/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  reviews: () => request<{ data: AdminReview[] }>("/reviews"),
  patchReview: (id: string, isPublic: boolean) =>
    request<{ data: AdminReview }>(`/reviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic }),
    }),
  analytics: (from: string, to: string) =>
    request<{ data: AdminAnalytics }>(
      `/analytics/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
};

export type AdminBooking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  manageToken: string;
  source: string;
  client: { id: string; name: string; phone: string };
  barber: { id: string; name: string };
  services: Array<{ name: string; price: number; durationMin: number }>;
};

export type AdminService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

export type AdminBarber = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  experienceYears: number;
  isActive: boolean;
  sortOrder: number;
  telegramChatId?: string | null;
  workingHours?: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
  }>;
  breaks?: Array<{ weekday: number; startTime: string; endTime: string }>;
  portfolioItems?: Array<{ id: string; imageUrl: string; sortOrder: number }>;
};

export type AdminTimeOff = {
  id: string;
  barberId: string | null;
  startsAt: string;
  endsAt: string;
  type: string;
  note: string | null;
  barber?: { id: string; name: string } | null;
};

export type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
  client: { name: string; phone: string };
  barber: { name: string };
};

export type AdminAnalytics = {
  period: { from: string; to: string };
  summary: {
    revenue: number;
    bookings: number;
    completed: number;
    confirmed: number;
    cancelled: number;
    noShow: number;
    cancelRate: number;
    noShowRate: number;
    uniqueClients: number;
    returningClients: number;
    retentionRate: number;
  };
  popularServices: Array<{
    serviceId: string | null;
    name: string;
    count: number;
    revenue: number;
  }>;
  barberLoad: Array<{
    barberId: string;
    name: string;
    bookings: number;
    completed: number;
    cancelled: number;
    noShow: number;
    minutes: number;
    revenue: number;
    capacityMin: number;
    utilizationPct: number;
  }>;
  heatmap: Array<{ weekday: number; hour: number; count: number }>;
};
