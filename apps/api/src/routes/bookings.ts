import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import {
  verifyTelegramInitData,
  telegramDisplayName,
} from "../lib/telegram.js";
import {
  cancelBooking,
  createBooking,
  getBookingByToken,
  rescheduleBooking,
} from "../services/bookings.js";

const createSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1),
  barberId: z.union([z.string().uuid(), z.literal("any")]),
  startsAt: z.string().min(1),
  client: z
    .object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().min(9).max(20).optional(),
    })
    .optional(),
  source: z.enum(["web", "telegram", "admin"]).optional(),
});

const rescheduleSchema = z.object({
  startsAt: z.string().min(1),
  barberId: z.union([z.string().uuid(), z.literal("any")]).optional(),
});

function serializeBooking(
  booking: Awaited<ReturnType<typeof getBookingByToken>>,
) {
  return {
    id: booking.id,
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    totalPrice: booking.totalPrice,
    totalDurationMin: booking.totalDurationMin,
    manageToken: booking.manageToken,
    source: booking.source,
    client: {
      name: booking.client.name,
      phone: booking.client.phone,
    },
    barber: {
      id: booking.barber.id,
      name: booking.barber.name,
      photoUrl: booking.barber.photoUrl,
    },
    services: booking.services.map((item) => ({
      serviceId: item.serviceId,
      name: item.name,
      durationMin: item.durationMin,
      price: item.price,
    })),
  };
}

export const bookingsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/bookings", async (request, reply) => {
    const body = createSchema.parse(request.body);
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw badRequest("Некорректная дата startsAt");
    }

    const initData = request.headers["x-telegram-init-data"] as
      | string
      | undefined;
    const source = body.source ?? (initData ? "telegram" : "web");

    let client = {
      name: body.client?.name?.trim() ?? "",
      phone: body.client?.phone?.trim() ?? "",
      telegramId: undefined as string | undefined,
    };

    if (initData) {
      const auth = verifyTelegramInitData(initData);
      client = {
        name: client.name || telegramDisplayName(auth.user),
        phone: client.phone || `tg:${auth.user.id}`,
        telegramId: String(auth.user.id),
      };
    }

    if (!client.name || client.name.length < 2) {
      throw badRequest("Укажите имя");
    }
    if (!client.phone || client.phone.length < 9) {
      throw badRequest("Укажите телефон");
    }

    const booking = await createBooking({
      serviceIds: body.serviceIds,
      barberId: body.barberId,
      startsAt,
      client,
      source,
    });

    return reply.status(201).send({ data: serializeBooking(booking) });
  });

  app.get("/bookings/:token", async (request) => {
    const { token } = z
      .object({ token: z.string().min(10) })
      .parse(request.params);
    const booking = await getBookingByToken(token);
    return { data: serializeBooking(booking) };
  });

  app.post("/bookings/:token/cancel", async (request) => {
    const { token } = z
      .object({ token: z.string().min(10) })
      .parse(request.params);
    const booking = await cancelBooking(token);
    return { data: serializeBooking(booking) };
  });

  app.post("/bookings/:token/reschedule", async (request) => {
    const { token } = z
      .object({ token: z.string().min(10) })
      .parse(request.params);
    const body = rescheduleSchema.parse(request.body);
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw badRequest("Некорректная дата startsAt");
    }

    const booking = await rescheduleBooking(token, startsAt, body.barberId);
    return { data: serializeBooking(booking) };
  });
};
