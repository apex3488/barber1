import { prisma } from "../lib/prisma.js";
import {
  addMinutes,
  atTashkent,
  listIsoDates,
  toIsoDateInTz,
  weekdayOfIsoDate,
  zonedParts,
} from "../lib/time.js";

export type AnalyticsPeriod = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD inclusive
};

function parseIsoDate(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

export function defaultAnalyticsPeriod(now = new Date()): AnalyticsPeriod {
  const to = toIsoDateInTz(now);
  const fromDate = addMinutes(atTashkent(to, "12:00"), -29 * 24 * 60);
  return { from: toIsoDateInTz(fromDate), to };
}

export function resolvePeriod(query: {
  from?: string;
  to?: string;
}): AnalyticsPeriod {
  const defaults = defaultAnalyticsPeriod();
  const from = parseIsoDate(query.from, defaults.from);
  const to = parseIsoDate(query.to, defaults.to);
  if (from > to) return { from: to, to: from };
  return { from, to };
}

export function periodBounds(period: AnalyticsPeriod) {
  const start = atTashkent(period.from, "00:00");
  const end = addMinutes(atTashkent(period.to, "00:00"), 24 * 60);
  return { start, end };
}

type BookingRow = {
  id: string;
  clientId: string;
  barberId: string;
  startsAt: Date;
  endsAt: Date;
  totalPrice: number;
  totalDurationMin: number;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  services: Array<{
    serviceId: string | null;
    name: string;
    price: number;
    durationMin: number;
  }>;
};

export function computeAnalytics(
  period: AnalyticsPeriod,
  bookings: BookingRow[],
  barbers: Array<{ id: string; name: string }>,
  schedule: Array<{
    barberId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>,
  breaks: Array<{
    barberId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>,
  timeOff: Array<{
    barberId: string | null;
    startsAt: Date;
    endsAt: Date;
  }>,
) {
  const { start, end } = periodBounds(period);
  const inPeriod = bookings.filter(
    (b) => b.startsAt >= start && b.startsAt < end,
  );

  const byStatus = {
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };
  for (const b of inPeriod) byStatus[b.status] += 1;

  const completed = inPeriod.filter((b) => b.status === "completed");
  const revenue = completed.reduce((sum, b) => sum + b.totalPrice, 0);

  const serviceMap = new Map<
    string,
    { serviceId: string | null; name: string; count: number; revenue: number }
  >();
  for (const booking of inPeriod.filter((b) => b.status !== "cancelled")) {
    for (const service of booking.services) {
      const key = service.serviceId ?? service.name;
      const prev = serviceMap.get(key) ?? {
        serviceId: service.serviceId,
        name: service.name,
        count: 0,
        revenue: 0,
      };
      prev.count += 1;
      prev.revenue += service.price;
      serviceMap.set(key, prev);
    }
  }
  const popularServices = [...serviceMap.values()].sort(
    (a, b) => b.count - a.count || b.revenue - a.revenue,
  );

  const dates = listIsoDates(atTashkent(period.from, "12:00"), daysInclusive(period));
  const load = barbers.map((barber) => {
    const rows = inPeriod.filter((b) => b.barberId === barber.id);
    const active = rows.filter(
      (b) => b.status === "confirmed" || b.status === "completed",
    );
    const bookedMin = active.reduce((sum, b) => sum + b.totalDurationMin, 0);
    const capacityMin = capacityForBarber(
      barber.id,
      dates,
      schedule,
      breaks,
      timeOff,
    );
    const utilization =
      capacityMin > 0 ? Math.round((bookedMin / capacityMin) * 1000) / 10 : 0;
    return {
      barberId: barber.id,
      name: barber.name,
      bookings: rows.length,
      completed: rows.filter((b) => b.status === "completed").length,
      cancelled: rows.filter((b) => b.status === "cancelled").length,
      noShow: rows.filter((b) => b.status === "no_show").length,
      minutes: bookedMin,
      revenue: rows
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + b.totalPrice, 0),
      capacityMin,
      utilizationPct: utilization,
    };
  });

  const cancellations = byStatus.cancelled;
  const noShows = byStatus.no_show;
  const denom = inPeriod.length || 1;

  const clientsInPeriod = new Map<string, number>();
  for (const b of completed) {
    clientsInPeriod.set(b.clientId, (clientsInPeriod.get(b.clientId) ?? 0) + 1);
  }
  const uniqueClients = clientsInPeriod.size;
  const returningClients = [...clientsInPeriod.values()].filter(
    (n) => n >= 2,
  ).length;
  const retentionRate =
    uniqueClients > 0
      ? Math.round((returningClients / uniqueClients) * 1000) / 10
      : 0;

  const heatmap = Array.from({ length: 7 }, (_, weekday) =>
    Array.from({ length: 24 }, (_, hour) => ({ weekday, hour, count: 0 })),
  );
  for (const b of inPeriod.filter(
    (row) => row.status === "confirmed" || row.status === "completed",
  )) {
    const parts = zonedParts(b.startsAt);
    heatmap[parts.weekday][parts.hour].count += 1;
  }

  return {
    period,
    summary: {
      revenue,
      bookings: inPeriod.length,
      completed: byStatus.completed,
      confirmed: byStatus.confirmed,
      cancelled: cancellations,
      noShow: noShows,
      cancelRate: Math.round((cancellations / denom) * 1000) / 10,
      noShowRate: Math.round((noShows / denom) * 1000) / 10,
      uniqueClients,
      returningClients,
      retentionRate,
    },
    popularServices,
    barberLoad: load.sort((a, b) => b.minutes - a.minutes),
    heatmap: heatmap.flat(),
  };
}

function daysInclusive(period: AnalyticsPeriod) {
  const start = atTashkent(period.from, "12:00").getTime();
  const end = atTashkent(period.to, "12:00").getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function parseHm(value: string) {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function capacityForBarber(
  barberId: string,
  dates: string[],
  schedule: Array<{
    barberId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>,
  breaks: Array<{
    barberId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>,
  timeOff: Array<{
    barberId: string | null;
    startsAt: Date;
    endsAt: Date;
  }>,
) {
  let total = 0;
  for (const iso of dates) {
    const weekday = weekdayOfIsoDate(iso);
    const dayStart = atTashkent(iso, "00:00");
    const dayEnd = addMinutes(dayStart, 24 * 60);
    const off = timeOff.some(
      (t) =>
        (t.barberId === null || t.barberId === barberId) &&
        t.startsAt < dayEnd &&
        t.endsAt > dayStart,
    );
    if (off) continue;

    const hours = schedule.filter(
      (h) => h.barberId === barberId && h.weekday === weekday,
    );
    for (const h of hours) {
      let minutes = parseHm(h.endTime) - parseHm(h.startTime);
      for (const br of breaks.filter(
        (b) => b.barberId === barberId && b.weekday === weekday,
      )) {
        const overlap =
          Math.min(parseHm(h.endTime), parseHm(br.endTime)) -
          Math.max(parseHm(h.startTime), parseHm(br.startTime));
        if (overlap > 0) minutes -= overlap;
      }
      if (minutes > 0) total += minutes;
    }
  }
  return total;
}

export async function getAnalyticsOverview(period: AnalyticsPeriod) {
  const { start, end } = periodBounds(period);
  const [bookings, barbers, schedule, breaks, timeOff] = await Promise.all([
    prisma.booking.findMany({
      where: { startsAt: { gte: start, lt: end } },
      select: {
        id: true,
        clientId: true,
        barberId: true,
        startsAt: true,
        endsAt: true,
        totalPrice: true,
        totalDurationMin: true,
        status: true,
        services: {
          select: {
            serviceId: true,
            name: true,
            price: true,
            durationMin: true,
          },
        },
      },
    }),
    prisma.barber.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.workingHours.findMany(),
    prisma.break.findMany(),
    prisma.timeOff.findMany({
      where: { startsAt: { lt: end }, endsAt: { gt: start } },
    }),
  ]);

  return computeAnalytics(
    period,
    bookings,
    barbers,
    schedule,
    breaks,
    timeOff,
  );
}
