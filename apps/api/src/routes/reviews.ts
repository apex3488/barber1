import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound, unprocessable } from "../lib/errors.js";
import { getAppSettings } from "../services/settings.js";

export const reviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/reviews/public", async () => {
    const settings = await getAppSettings();
    const minRating = Number(
      (
        await prisma.setting.findUnique({
          where: { key: "review_public_min_rating" },
        })
      )?.value ?? 4,
    );

    const items = await prisma.review.findMany({
      where: {
        isPublic: true,
        rating: { gte: Number.isFinite(minRating) ? minRating : 4 },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        client: { select: { name: true } },
        barber: { select: { name: true } },
      },
    });

    return {
      data: items.map((item) => ({
        id: item.id,
        rating: item.rating,
        comment: item.comment,
        author: item.client.name,
        barberName: item.barber.name,
        createdAt: item.createdAt.toISOString(),
      })),
      timezone: settings.timezone,
    };
  });

  app.post("/reviews", async (request, reply) => {
    const body = z
      .object({
        bookingId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1000).optional(),
      })
      .parse(request.body);

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      include: { review: true },
    });
    if (!booking) throw notFound("Запись не найдена");
    if (booking.status !== "completed") {
      throw unprocessable("Отзыв можно оставить только после визита", "NOT_COMPLETED");
    }
    if (booking.review) {
      throw badRequest("Отзыв уже оставлен", "REVIEW_EXISTS");
    }

    const minPublic = Number(
      (
        await prisma.setting.findUnique({
          where: { key: "review_public_min_rating" },
        })
      )?.value ?? 4,
    );

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        barberId: booking.barberId,
        clientId: booking.clientId,
        rating: body.rating,
        comment: body.comment,
        isPublic: body.rating >= (Number.isFinite(minPublic) ? minPublic : 4),
      },
    });

    return reply.status(201).send({
      data: {
        id: review.id,
        rating: review.rating,
        isPublic: review.isPublic,
      },
    });
  });
};
