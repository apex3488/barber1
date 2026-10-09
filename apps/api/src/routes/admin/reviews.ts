import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../lib/adminAuth.js";
import { notFound } from "../../lib/errors.js";

export const adminReviewsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request) => {
    await requireAdmin(request);
  });

  app.get("/reviews", async () => {
    const items = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, phone: true } },
        barber: { select: { name: true } },
        booking: { select: { startsAt: true } },
      },
    });
    return { data: items };
  });

  app.patch("/reviews/:id", async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({ isPublic: z.boolean() })
      .parse(request.body);
    try {
      const item = await prisma.review.update({
        where: { id },
        data: { isPublic: body.isPublic },
      });
      return { data: item };
    } catch {
      throw notFound("Отзыв не найден");
    }
  });
};
