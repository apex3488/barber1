import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { createBooking, rescheduleBooking } from "../../services/bookings.js";

type BookingFull = Awaited<
  ReturnType<
    typeof prisma.booking.findFirstOrThrow<{
      include: { client: true; barber: true; services: true };
    }>
  >
>;

function serialize(booking: BookingFull) {
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
      id: booking.client.id,
      name: booking.client.name,
      phone: booking.client.phone,
    },
    barber: { id: booking.barber.id, name: booking.barber.name },
    services: booking.services.map((s) => ({
      name: s.name,
      price: s.price,
      durationMin: s.durationMin,
      serviceId: s.serviceId,
    })),
  };
}

export const adminBookingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  app.get("/bookings", async (request) => {
    const query = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        status: z
          .enum(["confirmed", "completed", "cancelled", "no_show"])
          .optional(),
      })
      .parse(request.query);

    const items = await prisma.booking.findMany({
      where: {
        status: query.status,
        startsAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      orderBy: { startsAt: "asc" },
      include: { client: true, barber: true, services: true },
      take: 200,
    });

    return { data: items.map((item) => serialize(item)) };
  });

  app.post("/bookings", async (request, reply) => {
    const body = z
      .object({
        serviceIds: z.array(z.string().uuid()).min(1),
        barberId: z.string().uuid(),
        startsAt: z.string().min(1),
        client: z.object({
          name: z.string().trim().min(2),
          phone: z.string().trim().min(9),
        }),
      })
      .parse(request.body);

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw badRequest("Некорректная дата");

    const booking = await createBooking({
      ...body,
      startsAt,
      source: "admin",
    });
    return reply.status(201).send({ data: serialize(booking) });
  });

  app.patch("/bookings/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        status: z
          .enum(["confirmed", "completed", "cancelled", "no_show"])
          .optional(),
        startsAt: z.string().optional(),
        barberId: z.string().uuid().optional(),
      })
      .parse(request.body);

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { services: true },
    });
    if (!existing) throw notFound("Запись не найдена");

    if (body.startsAt) {
      const updated = await rescheduleBooking(
        existing.manageToken,
        new Date(body.startsAt),
        body.barberId,
        { skipCutoff: true },
      );
      return { data: serialize(updated) };
    }

    if (body.status) {
      // Admin может менять статус без клиентского cutoff
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: body.status },
        include: { client: true, barber: true, services: true },
      });
      return { data: serialize(updated) };
    }

    throw badRequest("Нечего обновлять");
  });
};
