import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { verifyTelegramInitData } from "../lib/telegram.js";
import {
  listClientBookings,
  upsertTelegramClient,
} from "../services/telegramClients.js";

function serializeBooking(
  booking: Awaited<ReturnType<typeof listClientBookings>>[number],
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

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/telegram", async (request) => {
    const body = z
      .object({
        initData: z.string().min(1),
        phone: z.string().trim().min(9).max(20).optional(),
      })
      .parse(request.body);

    const auth = verifyTelegramInitData(body.initData);
    const client = await upsertTelegramClient(auth.user, body.phone);

    return {
      data: {
        client: {
          id: client.id,
          name: client.name,
          phone: client.phone,
          telegramId: client.telegramId,
        },
        user: auth.user,
      },
    };
  });

  app.get("/me/bookings", async (request) => {
    const initData =
      (request.headers["x-telegram-init-data"] as string | undefined) ?? "";
    const auth = verifyTelegramInitData(initData);
    const client = await upsertTelegramClient(auth.user);
    const bookings = await listClientBookings(client.id);
    return { data: bookings.map(serializeBooking) };
  });
};
