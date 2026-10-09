import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { notFound } from "../../lib/errors.js";

export const adminTimeOffRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  app.get("/time-off", async () => {
    const items = await prisma.timeOff.findMany({
      orderBy: { startsAt: "asc" },
      include: { barber: { select: { id: true, name: true } } },
    });
    return { data: items };
  });

  app.post("/time-off", async (request, reply) => {
    const body = z
      .object({
        barberId: z.string().uuid().nullable().optional(),
        startsAt: z.string().min(1),
        endsAt: z.string().min(1),
        type: z.enum(["day_off", "vacation", "sick", "shop_closed", "other"]),
        note: z.string().optional().nullable(),
      })
      .parse(request.body);

    const item = await prisma.timeOff.create({
      data: {
        barberId: body.barberId ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        type: body.type,
        note: body.note,
      },
    });
    return reply.status(201).send({ data: item });
  });

  app.delete("/time-off/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    try {
      await prisma.timeOff.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw notFound("Исключение не найдено");
    }
  });
};
