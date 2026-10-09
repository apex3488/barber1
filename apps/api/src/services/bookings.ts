import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { conflict, notFound, unprocessable } from "../lib/errors.js";
import { totalDuration, totalPrice } from "../lib/slots.js";
import { addMinutes } from "../lib/time.js";
import {
  notifyBookingCancelled,
  notifyBookingCreated,
  notifyBookingRescheduled,
} from "../bot/notifications.js";
import { assertSlotAvailable, loadServicesOrThrow } from "./availability.js";
import { getAppSettings } from "./settings.js";

function manageToken() {
  return randomBytes(24).toString("hex");
}

function rethrowIfSlotTaken(error: unknown): never {
  const text = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (
    code === "23P01" ||
    text.includes("23P01") ||
    text.includes("bookings_no_overlap") ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || text.includes("exclusion")))
  ) {
    throw conflict("Этот слот уже занят", "SLOT_TAKEN");
  }

  throw error;
}

export async function createBooking(input: {
  serviceIds: string[];
  barberId: string;
  startsAt: Date;
  client: { name: string; phone: string; telegramId?: string };
  source?: "web" | "telegram" | "admin";
}) {
  const now = new Date();
  const settings = await getAppSettings();
  const services = await loadServicesOrThrow(input.serviceIds);
  const durationMin = totalDuration(services);
  const price = totalPrice(services);
  const endsAt = addMinutes(input.startsAt, durationMin);

  if (input.startsAt < addMinutes(now, settings.minNoticeMin)) {
    throw unprocessable("Слишком поздно для записи на это время", "TOO_SOON");
  }

  const horizonEnd = addMinutes(now, settings.bookingHorizonDays * 24 * 60);
  if (input.startsAt > horizonEnd) {
    throw unprocessable("Дата слишком далеко для записи", "TOO_FAR");
  }

  const resolvedBarberId = await assertSlotAvailable({
    serviceIds: input.serviceIds,
    barberId: input.barberId,
    startsAt: input.startsAt,
    now,
  });

  try {
    const booking = await prisma.$transaction(async (tx) => {
      let client = input.client.telegramId
        ? await tx.client.findUnique({
            where: { telegramId: input.client.telegramId },
          })
        : null;

      if (!client) {
        client = await tx.client.findFirst({
          where: { phone: input.client.phone },
        });
      }

      if (!client) {
        client = await tx.client.create({
          data: {
            name: input.client.name.trim(),
            phone: input.client.phone,
            telegramId: input.client.telegramId,
            telegramChatId: input.client.telegramId,
          },
        });
      } else {
        client = await tx.client.update({
          where: { id: client.id },
          data: {
            name: input.client.name.trim() || client.name,
            phone: input.client.phone || client.phone,
            telegramId: input.client.telegramId ?? client.telegramId,
            telegramChatId:
              input.client.telegramId ?? client.telegramChatId,
          },
        });
      }

      return tx.booking.create({
        data: {
          clientId: client.id,
          barberId: resolvedBarberId,
          startsAt: input.startsAt,
          endsAt,
          totalPrice: price,
          totalDurationMin: durationMin,
          status: "confirmed",
          source: input.source ?? "web",
          manageToken: manageToken(),
          services: {
            create: services.map((service) => ({
              serviceId: service.id,
              name: service.name,
              durationMin: service.durationMin,
              price: service.price,
            })),
          },
        },
        include: {
          barber: true,
          client: true,
          services: true,
        },
      });
    });

    void notifyBookingCreated(booking.id);
    return booking;
  } catch (error) {
    rethrowIfSlotTaken(error);
  }
}

export async function getBookingByToken(token: string) {
  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: {
      barber: true,
      client: true,
      services: true,
    },
  });
  if (!booking) throw notFound("Запись не найдена");
  return booking;
}

export async function cancelBooking(token: string) {
  const booking = await getBookingByToken(token);
  if (booking.status !== "confirmed") {
    throw unprocessable("Запись нельзя отменить", "INVALID_STATUS");
  }

  const settings = await getAppSettings();
  const cutoff = addMinutes(new Date(), settings.cancelCutoffMin);
  if (booking.startsAt < cutoff) {
    throw unprocessable(
      "Отмена слишком поздно — меньше чем за 30 минут",
      "CANCEL_TOO_LATE",
    );
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled" },
    include: {
      barber: true,
      client: true,
      services: true,
    },
  });

  void notifyBookingCancelled(updated.id);
  return updated;
}

export async function rescheduleBooking(
  token: string,
  startsAt: Date,
  barberId?: string,
  options?: { skipCutoff?: boolean },
) {
  const booking = await getBookingByToken(token);
  if (booking.status !== "confirmed") {
    throw unprocessable("Запись нельзя перенести", "INVALID_STATUS");
  }

  if (!options?.skipCutoff) {
    const settings = await getAppSettings();
    const cutoff = addMinutes(new Date(), settings.cancelCutoffMin);
    if (booking.startsAt < cutoff) {
      throw unprocessable("Перенос слишком поздно", "RESCHEDULE_TOO_LATE");
    }
  }

  const serviceIds = booking.services
    .map((item) => item.serviceId)
    .filter((id): id is string => Boolean(id));

  if (serviceIds.length === 0) {
    throw unprocessable("У записи нет услуг для переноса", "NO_SERVICES");
  }

  const targetBarberId = barberId ?? booking.barberId;
  const endsAt = addMinutes(startsAt, booking.totalDurationMin);

  const resolvedBarberId = await assertSlotAvailable({
    serviceIds,
    barberId: targetBarberId,
    startsAt,
  });

  try {
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        barberId: resolvedBarberId,
        startsAt,
        endsAt,
      },
      include: {
        barber: true,
        client: true,
        services: true,
      },
    });
    void notifyBookingRescheduled(updated.id);
    return updated;
  } catch (error) {
    rethrowIfSlotTaken(error);
  }
}
