export type ApiService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
  sortOrder?: number;
};

export type ApiBarber = {
  id: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  experienceYears: number;
  sortOrder?: number;
};

export type ApiBarberDetails = ApiBarber & {
  portfolio: Array<{ id: string; imageUrl: string; sortOrder: number }>;
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    price: number;
  }>;
};

export type ApiBooking = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  totalDurationMin: number;
  manageToken: string;
  source: string;
  client: { name: string; phone: string };
  barber: { id: string; name: string; photoUrl: string | null };
  services: Array<{
    serviceId: string | null;
    name: string;
    durationMin: number;
    price: number;
  }>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:3001"
  );
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Ошибка API (${response.status})`;
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
  return new ApiError(response.status, code, message);
}

async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

async function apiSend<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export async function fetchServices(): Promise<ApiService[]> {
  const result = await apiGet<{ data: ApiService[] }>("/api/v1/services", {
    next: { revalidate: 30 },
  });
  return result.data;
}

export async function fetchBarbers(): Promise<ApiBarber[]> {
  const result = await apiGet<{ data: ApiBarber[] }>("/api/v1/barbers", {
    next: { revalidate: 30 },
  });
  return result.data;
}

export async function fetchBarber(id: string): Promise<ApiBarberDetails> {
  const result = await apiGet<{ data: ApiBarberDetails }>(
    `/api/v1/barbers/${id}`,
    { cache: "no-store" },
  );
  return result.data;
}

export async function fetchAvailability(params: {
  serviceIds: string[];
  barberId: string;
  date: string;
}): Promise<string[]> {
  const query = new URLSearchParams({
    serviceIds: params.serviceIds.join(","),
    barberId: params.barberId,
    date: params.date,
  });
  const result = await apiGet<{ data: { slots: string[] } }>(
    `/api/v1/availability?${query}`,
    { cache: "no-store" },
  );
  return result.data.slots;
}

export async function fetchAvailabilityDays(params: {
  serviceIds: string[];
  barberId: string;
}): Promise<string[]> {
  const query = new URLSearchParams({
    serviceIds: params.serviceIds.join(","),
    barberId: params.barberId,
  });
  const result = await apiGet<{ data: { days: string[] } }>(
    `/api/v1/availability/days?${query}`,
    { cache: "no-store" },
  );
  return result.data.days;
}

export async function createBooking(input: {
  serviceIds: string[];
  barberId: string;
  startsAt: string;
  client: { name: string; phone: string };
}): Promise<ApiBooking> {
  const result = await apiSend<{ data: ApiBooking }>(
    "/api/v1/bookings",
    "POST",
    input,
  );
  return result.data;
}

export async function fetchBooking(token: string): Promise<ApiBooking> {
  const result = await apiGet<{ data: ApiBooking }>(
    `/api/v1/bookings/${token}`,
    { cache: "no-store" },
  );
  return result.data;
}

export async function cancelBooking(token: string): Promise<ApiBooking> {
  const result = await apiSend<{ data: ApiBooking }>(
    `/api/v1/bookings/${token}/cancel`,
    "POST",
  );
  return result.data;
}

export async function rescheduleBooking(
  token: string,
  input: { startsAt: string; barberId?: string },
): Promise<ApiBooking> {
  const result = await apiSend<{ data: ApiBooking }>(
    `/api/v1/bookings/${token}/reschedule`,
    "POST",
    input,
  );
  return result.data;
}

/** Локальная дата+время Ташкента → ISO UTC */
export function tashkentToIso(isoDate: string, hhmm: string): string {
  return new Date(`${isoDate}T${hhmm}:00+05:00`).toISOString();
}
