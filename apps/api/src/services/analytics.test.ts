import { describe, expect, it } from "vitest";
import { atTashkent } from "../lib/time.js";
import {
  computeAnalytics,
  defaultAnalyticsPeriod,
  periodBounds,
  resolvePeriod,
} from "./analytics.js";

describe("analytics period", () => {
  it("нормализует from/to", () => {
    expect(resolvePeriod({ from: "2026-10-10", to: "2026-10-01" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-10",
    });
  });

  it("даёт границы дня в Tashkent", () => {
    const { start, end } = periodBounds({
      from: "2026-10-01",
      to: "2026-10-01",
    });
    expect(start.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-01T19:00:00.000Z");
  });

  it("default период — 30 дней", () => {
    const period = defaultAnalyticsPeriod(atTashkent("2026-10-09", "12:00"));
    expect(period).toEqual({ from: "2026-09-10", to: "2026-10-09" });
  });
});

describe("computeAnalytics", () => {
  const period = { from: "2026-10-01", to: "2026-10-07" };
  const barbers = [
    { id: "b1", name: "Азиз" },
    { id: "b2", name: "Жасур" },
  ];
  const schedule = [
    {
      barberId: "b1",
      weekday: 4, // Thu 2026-10-01
      startTime: "10:00",
      endTime: "12:00",
    },
  ];

  const bookings = [
    {
      id: "1",
      clientId: "c1",
      barberId: "b1",
      startsAt: atTashkent("2026-10-01", "10:00"),
      endsAt: atTashkent("2026-10-01", "10:45"),
      totalPrice: 120000,
      totalDurationMin: 45,
      status: "completed" as const,
      services: [
        {
          serviceId: "s1",
          name: "Стрижка",
          price: 120000,
          durationMin: 45,
        },
      ],
    },
    {
      id: "2",
      clientId: "c1",
      barberId: "b1",
      startsAt: atTashkent("2026-10-03", "11:00"),
      endsAt: atTashkent("2026-10-03", "11:30"),
      totalPrice: 80000,
      totalDurationMin: 30,
      status: "completed" as const,
      services: [
        {
          serviceId: "s2",
          name: "Борода",
          price: 80000,
          durationMin: 30,
        },
      ],
    },
    {
      id: "3",
      clientId: "c2",
      barberId: "b2",
      startsAt: atTashkent("2026-10-02", "12:00"),
      endsAt: atTashkent("2026-10-02", "13:00"),
      totalPrice: 150000,
      totalDurationMin: 60,
      status: "cancelled" as const,
      services: [
        {
          serviceId: "s1",
          name: "Стрижка",
          price: 150000,
          durationMin: 60,
        },
      ],
    },
    {
      id: "4",
      clientId: "c3",
      barberId: "b1",
      startsAt: atTashkent("2026-10-04", "15:00"),
      endsAt: atTashkent("2026-10-04", "15:45"),
      totalPrice: 120000,
      totalDurationMin: 45,
      status: "no_show" as const,
      services: [
        {
          serviceId: "s1",
          name: "Стрижка",
          price: 120000,
          durationMin: 45,
        },
      ],
    },
  ];

  it("считает выручку только по completed", () => {
    const result = computeAnalytics(
      period,
      bookings,
      barbers,
      schedule,
      [],
      [],
    );
    expect(result.summary.revenue).toBe(200000);
    expect(result.summary.completed).toBe(2);
    expect(result.summary.bookings).toBe(4);
    expect(result.summary.cancelled).toBe(1);
    expect(result.summary.noShow).toBe(1);
  });

  it("считает популярные услуги без cancelled", () => {
    const result = computeAnalytics(
      period,
      bookings,
      barbers,
      schedule,
      [],
      [],
    );
    expect(result.popularServices[0]).toMatchObject({
      name: "Стрижка",
      count: 2,
    });
  });

  it("считает возвращаемость", () => {
    const result = computeAnalytics(
      period,
      bookings,
      barbers,
      schedule,
      [],
      [],
    );
    // c1 имеет 2 completed, unique completed clients = 1
    expect(result.summary.uniqueClients).toBe(1);
    expect(result.summary.returningClients).toBe(1);
    expect(result.summary.retentionRate).toBe(100);
  });

  it("строит heatmap по часам Tashkent", () => {
    const result = computeAnalytics(
      period,
      bookings,
      barbers,
      schedule,
      [],
      [],
    );
    const cell = result.heatmap.find((c) => c.weekday === 4 && c.hour === 10);
    expect(cell?.count).toBe(1);
  });

  it("считает загрузку барбера", () => {
    const result = computeAnalytics(
      period,
      bookings,
      barbers,
      schedule,
      [],
      [],
    );
    const aziz = result.barberLoad.find((b) => b.barberId === "b1");
    expect(aziz?.minutes).toBe(75); // completed 45+30; no_show не считается
    expect(aziz?.revenue).toBe(200000);
    expect(aziz?.capacityMin).toBe(120); // Thu 10-12, 1 октября
  });
});


