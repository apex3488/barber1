import { prisma } from "../lib/prisma.js";
import { badRequest, notFound, unprocessable } from "../lib/errors.js";
import {
  computeSlotStarts,
  parseTimeInterval,
  totalDuration,
  type BusyInterval,
} from "../lib/slots.js";
import {
  addMinutes,
  atTashkent,
  listIsoDates,
  toIsoDateInTz,
  weekdayOfIsoDate,
} from "../lib/time.js";
import { getAppSettings } from "./settings.js";

export async function loadServicesOrThrow(serviceIds: string[]) {
  if (serviceIds.length === 0) {
    throw badRequest("Нужно выбрать хотя бы одну услугу");
  }

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true },
  });

  if (services.length !== serviceIds.length) {
    throw notFound("Одна или несколько услуг не найдены");
  }

  // preserve request order
  const byId = new Map(services.map((item) => [item.id, item]));
  return serviceIds.map((id) => byId.get(id)!);
}

async function resolveBarbers(barberId: string, serviceIds: string[]) {
  if (barberId === "any") {
    const barbers = await prisma.barber.findMany({
      where: {
        isActive: true,
        services: {
          some: {
            isEnabled: true,
            serviceId: { in: serviceIds },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (barbers.length === 0) {
      throw notFound("Нет доступных барберов для выбранных услуг");
    }
    return barbers;
  }

  const barber = await prisma.barber.findFirst({
    where: { id: barberId, isActive: true },
  });
  if (!barber) throw notFound("Барбер не найден");

  const links = await prisma.barberService.count({
    where: {
      barberId,
      isEnabled: true,
      serviceId: { in: serviceIds },
    },
  });
  if (links !== serviceIds.length) {
    throw unprocessable(
      "Барбер не оказывает одну или несколько выбранных услуг",
      "SERVICE_NOT_OFFERED",
    );
  }

  return [barber];
}

async function loadBusyForBarber(
  barberId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<BusyInterval[]> {
  const [bookings, personalOff, shopOff] = await Promise.all([
    prisma.booking.findMany({
      where: {
        barberId,
        status: "confirmed",
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        barberId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        barberId: null,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  return [...bookings, ...personalOff, ...shopOff];
}

export async function getSlotsForDay(params: {
  serviceIds: string[];
  barberId: string;
  date: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const settings = await getAppSettings();
  const services = await loadServicesOrThrow(params.serviceIds);
  const durationMin = totalDuration(services);
  const barbers = await resolveBarbers(params.barberId, params.serviceIds);

  const horizonEnd = addMinutes(now, settings.bookingHorizonDays * 24 * 60);
  const dayStart = atTashkent(params.date, "00:00");
  if (dayStart > horizonEnd) {
    throw unprocessable(
      "Дата слишком далеко для записи",
      "TOO_FAR",
    );
  }

  const weekday = weekdayOfIsoDate(params.date);
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const slotSet = new Set<string>();

  for (const barber of barbers) {
    const working = await prisma.workingHours.findUnique({
      where: {
        barberId_weekday: { barberId: barber.id, weekday },
      },
    });
    if (!working) continue;

    const breaks = await prisma.break.findMany({
      where: { barberId: barber.id, weekday },
    });
    const busy = await loadBusyForBarber(barber.id, dayStart, dayEnd);

    const slots = computeSlotStarts({
      isoDate: params.date,
      durationMin,
      workingHours: parseTimeInterval(working.startTime, working.endTime),
      breaks: breaks.map((item) =>
        parseTimeInterval(item.startTime, item.endTime),
      ),
      busy,
      slotStepMin: settings.slotStepMin,
      now,
      minNoticeMin: settings.minNoticeMin,
    });

    for (const slot of slots) slotSet.add(slot);
  }

  return {
    date: params.date,
    durationMin,
    slots: [...slotSet].sort(),
  };
}

export async function getAvailableDays(params: {
  serviceIds: string[];
  barberId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const settings = await getAppSettings();
  const dates = listIsoDates(now, settings.bookingHorizonDays);
  const available: string[] = [];

  for (const date of dates) {
    const result = await getSlotsForDay({
      serviceIds: params.serviceIds,
      barberId: params.barberId,
      date,
      now,
    });
    if (result.slots.length > 0) available.push(date);
  }

  return {
    from: toIsoDateInTz(now),
    days: available,
  };
}

export async function assertSlotAvailable(params: {
  serviceIds: string[];
  barberId: string;
  startsAt: Date;
  now?: Date;
}) {
  const isoDate = toIsoDateInTz(params.startsAt);
  const hhmm = (() => {
    const shifted = new Date(params.startsAt.getTime() + 5 * 60 * 60 * 1000);
    return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(
      shifted.getUTCMinutes(),
    ).padStart(2, "0")}`;
  })();

  if (params.barberId === "any") {
    const result = await getSlotsForDay({
      serviceIds: params.serviceIds,
      barberId: "any",
      date: isoDate,
      now: params.now,
    });
    if (!result.slots.includes(hhmm)) {
      throw unprocessable("Слот недоступен", "SLOT_UNAVAILABLE");
    }

    const barbers = await resolveBarbers("any", params.serviceIds);
    for (const barber of barbers) {
      const single = await getSlotsForDay({
        serviceIds: params.serviceIds,
        barberId: barber.id,
        date: isoDate,
        now: params.now,
      });
      if (single.slots.includes(hhmm)) {
        return barber.id;
      }
    }
    throw unprocessable("Слот недоступен", "SLOT_UNAVAILABLE");
  }

  const result = await getSlotsForDay({
    serviceIds: params.serviceIds,
    barberId: params.barberId,
    date: isoDate,
    now: params.now,
  });
  if (!result.slots.includes(hhmm)) {
    throw unprocessable("Слот недоступен", "SLOT_UNAVAILABLE");
  }
  return params.barberId;
}
